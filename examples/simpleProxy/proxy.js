/**
 * This example script demonstrates a basic proxy of the audio and metadata
 * through a Node HTTP server. The command-line tools `lame` and `oggenc` are
 * required for this to work. Invoking this script will start the HTTP server
 * on port 8080. If the browser requests:
 *
 *    "/"           - The index page will be returned.
 *    "/stream"     - Returns the raw PCM data from the transcoded input radio stream.
 *    "/stream.mp3" - Returns the radio stream, fed through `lame` and sent to the
 *                    client as MP3 audio data.
 *    "/stream.ogg" - Returns the radio stream, fed through `oggenc` and sent to
 *                    the client as OGG Vorbis audio data.
 *    "/metadata"   - A long-polling URI, which will return the value of the
 *                    metadata when a 'metadata' event happens on the
 *                    associated radio stream.
 *   Usage:
 *     node examples/proxy.js [URL of Icecast Stream to proxy]
 */
require("colors");
var fs = require("fs");
var http = require("http");
var spawn = require("child_process").spawn;
var icecast = require("icecast-stack");
var stations = require("../radioStations");

// If you pass a URL to a SHOUTcast/Icecast stream, then we'll use that,
// otherwise get a random one from the "radioStations.json" file.
var station;
if (process.argv[2]) {
  station = stations.fromName(process.argv[2]);
  if (!station) station = process.argv[2];
} else {
  //station = stations.random().url;
  station = stations.fromName("4 Ever Floyd");
}
console.error("Connecting to:".green.italic.bold);
console.error(('  '+station.name.bold+': '+station.url).green);

// Connect to the remote radio stream, and pass the raw audio data to any
// client requesting the "/stream" URL (will be an <audio> tag).
var stream = require('icecast-stack/client').createClient(station.url);

// If the remote connection to the radio stream closes, then just shutdown the
// server and print an error. Do something more elegant in a real world scenario.
stream.on("close", function() {
  console.error(("Connection to '"+station.name+"' was closed!").red.bold);
  process.exit(1);
});

// Decode the MP3 stream to raw PCM data, signed 16-bit Little-endian
var pcm = spawn("lame", [
  "-S", // Operate silently (nothing to stderr)
  "--mp3input", // Decode the MP3 input
  "-", // Input from stdin
  "--decode",
  "-t", // Don't include WAV header info (i.e. output raw PCM)
  "-s", "48", // Sampling rate: 48,000
  "--bitwidth", "16", // Bits per Sample: 16
  "--signed", "--little-endian", // Signed, little-endian samples
  "-" // Output to stdout
]);
stream.on("data", function(chunk) {
  pcm.stdin.write(chunk);
});

// A simple "Burst-on-Connect" implementation. We'll store the previous 2mb
// of raw PCM data, and send it each time a new connection is made.
var bocData = [];
var bocSize = 2097152; // 2mb in bytes
pcm.stdout.on("data", function(chunk) {
  while (currentBocSize() > bocSize) {
    bocData.shift();
  }
  bocData.push(chunk);
});
function currentBocSize() {
  var size = 0, i=0, l=bocData.length;
  for (; i<l; i++) {
    size += bocData[i].length;
  }
  return size;
}

// We have to keep track of the currently playing song, so that we can
// respond when "/metadata" is requested with an "X-Current-Track" header.
var currentTrack;
stream.on("metadata", function(metadata) {
  currentTrack = icecast.parseMetadata(metadata).StreamTitle;
  console.error(("Received 'metadata' event: ".bold + currentTrack).blue);
});

// Now we create the HTTP server.
http.createServer(function(req, res) {

  // Does the client support icecast metadata?
  var acceptsMetadata = req.headers['icy-metadata'] == 1;

  // If the client simple requests 'stream', then send back the raw PCM data.
  // I use this for debugging; piping the output to other command-line encoders.
  if (req.url == "/stream") {
    var connected = function() {
      var headers = {};
      for (var key in stream.headers) {
        if (key == 'icy-metaint') continue;
        headers[key] = stream.headers[key];
      }
      res.writeHead(200, headers);
      var callback = function(chunk) {
        res.write(chunk);
      }
      pcm.stdout.on("data", callback);
      req.connection.on("close", function() {
        // This occurs when the HTTP client closes the connection.
        pcm.stdout.removeListener("data", callback);
      });      
    }
    if (stream.headers) {
      connected();
    } else {
      stream.on("response", connected);
    }

  // If "/stream.mp3" is requested, fire up an MP3 encoder (lame), and start
  // streaming the MP3 data to the client.
  } else if (req.url == "/stream.mp3") {

    var headers = {
      "Content-Type": "audio/mpeg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = stream.headers['icy-name'];
      headers['icy-metaint'] = 10000;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, 10000);
      res.queueMetadata(currentTrack);
      var metadataCallback = function(metadata) {
        res.queueMetadata(metadata);
      }
      stream.on('metadata', metadataCallback);
    }

    var mp3 = spawn("lame", [
      "-S", // Operate silently (nothing to stderr)
      "-r", // Input is raw PCM
      "-s", "48", // Input sampling rate: 48,000
      "-", // Input from stdin
      "-" // Output to stderr
    ]);
    mp3.on("exit", function(exitCode) {
      console.error("mp3.onExit: "+ exitCode);
    });
    mp3.on("error", function(error) {
      console.error("mp3.onError: ", error);
    });
    mp3.stdin.on("error", function(error) {
      console.error("mp3.stdin.onError: ", error);
    });
    mp3.stdout.on("error", function(error) {
      console.error("mp3.stdout.onError: ", error);
    });
    mp3.stdout.on("data", function(chunk) {
      res.write(chunk);
    });

    // First, send what's inside the "Burst-on-Connect" buffers.
    for (var i=0, l=bocData.length; i<l; i++) {
      mp3.stdin.write(bocData[i]);
    }

    // Then start sending the incoming PCM data to the MP3 encoder
    var callback = function(chunk) {
      mp3.stdin.write(chunk);
    }
    pcm.stdout.on("data", callback);

    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      pcm.stdout.removeListener("data", callback);
      mp3.kill();
      if (metadataCallback) {
        stream.removeListener('metadata', metadataCallback);
      }
    });

  // If "/stream.ogg" is requested, fire up an OGG encoder (oggenc), and start
  // streaming the OGG vorbis data to the client.
  } else if (req.url == "/stream.ogg") {

    var headers = {
      "Content-Type": "application/ogg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = stream.headers['icy-name'];
      headers['icy-metaint'] = 10000;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, 10000);
      res.queueMetadata(currentTrack);
      var metadataCallback = function(metadata) {
        res.queueMetadata(metadata);
      }
      stream.on('metadata', metadataCallback);
    }

    var ogg = spawn("oggenc", [
      "--silent", // Operate silently (nothing to stderr)
      "-r", // Raw input
      "--ignorelength", // Ignore length
      "--raw-rate=48000", // Raw input rate: 48000
      "-" // Input from stdin, Output to stderr
    ]);
    ogg.on("exit", function(exitCode) {
      console.error("ogg.onExit: "+ exitCode);
    });
    ogg.on("error", function(error) {
      console.error(error);
    });
    ogg.stdin.on("error", function(error) {
      console.error("ogg.stdin.onError: ", error);
    });
    ogg.stdout.on("error", function(error) {
      console.error("ogg.stdout.onError: ", error);
    });
    ogg.stdout.on("data", function(chunk) {
      res.write(chunk);
    });

    // First, send what's inside the "Burst-on-Connect" buffers.
    for (var i=0, l=bocData.length; i<l; i++) {
      ogg.stdin.write(bocData[i]);
    }

    // Then start sending the incoming PCM data to the OGG encoder
    var callback = function(chunk) {
      ogg.stdin.write(chunk);
    }
    pcm.stdout.on("data", callback);

    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      pcm.stdout.removeListener("data", callback);
      ogg.kill();
      if (metadataCallback) {
        stream.removeListener('metadata', metadataCallback);
      }
    });

  // If "/metadata" is requested, then hold of on sending any response, but
  // request the `icecast.ReadStream` instance to notify the request of the next
  // 'metadata' event.
  } else if (req.url == "/metadata") {
    req.connection.setTimeout(0); // Disable timeouts
    if (req.headers['x-current-track'] && currentTrack) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(currentTrack)
      });
      res.end(currentTrack);
    } else {
      stream.once("metadata", function(metadata) {
        var response = icecast.parseMetadata(metadata).StreamTitle;
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(response)
        });
        res.end(response);
      });
    }

  // Otherwise just serve the "index.html" file.
  } else {
    fs.readFile(__dirname + "/index.html", function(err, buffer) {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': buffer.length
      });
      res.end(buffer);
    });
  }

}).listen(8080, function() {
  console.error(("HTTP Icecast proxy server listening at: ".bold + "http://*:" + this.address().port).cyan);
  console.error(("Type a line and press enter to manually fire a "+"'metadata'".bold+" event").yellow);
});

// You can manually simulate and send a 'metadata' event to the connected
// clients by appending a line to 'stdin'
var stdin = process.openStdin();
stdin.setEncoding('ascii');
stdin.on('data', function(line) {
  stream.emit('metadata', "StreamTitle='" + line.trim() + "';");
});

