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
var fs = require("fs");
var http = require("http");
var spawn = require("child_process").spawn;
var radio = require("../../lib/radio-stream");
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
console.error("Connecting to:");
console.error(station);

// The port the HTTP proxy server is going to be listening on:
var port = 8080;

// Connect to the remote radio stream, and pass the raw audio data to any
// client requesting the "/stream" URL (will be an <audio> tag).
var stream = radio.createReadStream(station.url);

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
  "-" // Output to stderr
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
  //console.error(currentBocSize());
});
function currentBocSize() {
  var size = 0, i=0, l=bocData.length;
  for (; i<l; i++) {
    size += bocData[i].length;
  }
  return size;
}

// Now we create the HTTP server.
http.createServer(function(req, res) {

  // If the client simple requests 'stream', then send back the raw PCM data.
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
    if (stream.connected) {
      connected();
    } else {
      stream.on("connect", connected);
    }

  // If "/stream.mp3" is requested, fire up an MP3 encoder (lame), and start
  // streaming the MP3 data to the client.
  } else if (req.url == "/stream.mp3") {
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
      // Send the response header on the first MP3 'data' event.
      if (!res.headerWritten) {
        res.headerWritten = true;
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Connection": "close",
          "Transfer-Encoding": "identity"
        });
      }
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
    });      

  // If "/stream.ogg" is requested, fire up an OGG encoder (oggenc), and start
  // streaming the OGG vorbis data to the client.
  } else if (req.url == "/stream.ogg") {
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
      // Send the response header on the first OGG 'data' event.
      if (!res.headerWritten) {
        res.headerWritten = true;
        res.writeHead(200, {
          "Content-Type": "application/ogg",
          "Connection": "close",
          "Transfer-Encoding": "identity"
        });
      }
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
    });

  // If "/metadata" is requested, then hold of on sending any response, but
  // request the `radio.Stream` instance to notify the request of the next
  // 'metadata' event.
  } else if (req.url == "/metadata") {
    req.connection.setTimeout(0); // Disable timeouts
    var callback = function(metadata) {
      stream.removeListener("metadata", callback);
      var response = radio.parseMetadata(metadata).StreamTitle;
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(response)
      });
      res.end(response);
    }
    // TODO: Use `EventEmitter#once` when 0.3 lands.
    stream.on("metadata", callback);

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

}).listen(port);
console.error("HTTP server listening at: http://*:" + port);


// Shouldn't be needed; just in case...
process.on("uncaughtException", function(ex) {
  console.error("Uncaught Exception: ", ex);
});
