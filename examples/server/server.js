require("colors");
var fs = require("fs");
var http = require("http");
var spawn = require("child_process").spawn;
var icecast = require("icecast-stack");

// An external script is meant to be writing PCM data to stdin of the server.
var stdin = process.openStdin();

// Stdin is expecting raw PCM data of the format:
var SAMPLE_SIZE = 16;   // 16-bit samples, Little-Endian, Signed
var CHANNELS = 2;       // 2 channels (left and right)
var SAMPLE_RATE = 44100;// 44,100 Hz sample rate.

// If we're getting raw PCM data as expected, calculate the number of bytes
// that need to be read for `1 Second` of audio data.
var BLOCK_ALIGN = SAMPLE_SIZE / 8 * CHANNELS; // Number of 'Bytes per Sample'
var BYTES_PER_SECOND = SAMPLE_RATE * BLOCK_ALIGN;

// Needed for throttling stdin.
var startTime = new Date();
var totalBytes = 0;

// A simple "Burst-on-Connect" implementation. We'll store the previous "10
// seconds" worth of raw PCM data, and send it each time a new connection is made.
// We also do throttling of stdin on the 'data' event. Since the raw PCM
// has a liner BYTES_PER_SECOND count, we can calculate an 'expected' value
// by now, and pause() if we've past that value.
var bocData = [];
var bocSize = BYTES_PER_SECOND * 10; // 10 raw PCM seconds in bytes
stdin.on("data", function(chunk) {
  totalBytes += chunk.length;
  var totalSeconds = ((new Date()) - startTime) / 1000;
  var expected = totalSeconds * BYTES_PER_SECOND;
  //console.log(totalBytes, expected);
  if (totalBytes > expected) {
    stdin.pause();
    // Use this byte count to calculate how many seconds ahead we are.
    var remainder = totalBytes - expected;
    setTimeout(function() {
      stdin.resume();
    }, remainder / BYTES_PER_SECOND * 1000);
  }

  bocData.push(chunk);
  var removed = 0;
  while (currentBocSize() > bocSize) {
    removed += bocData.shift().length;
  }
  
  // If we've removed a number of bytes that isn't a multiple of BLOCK_ALIGN,
  // then we'd be left with a partial audio sample, which at best case reverses
  // the audio channels, and at worst makes the bytes 16-bit ints be offset by 1,
  // resulting in awful static sound.
  var stillToRemove = removed % BLOCK_ALIGN;
  if (stillToRemove > 0) {
    // We're assuming bocData[0] has AT LEAST BLOCK_ALIGN bytes in it.
    bocData[0] = bocData[0].slice(stillToRemove);
  }
});
function currentBocSize() {
  var size = 0, i=0, l=bocData.length;
  for (; i<l; i++) {
    size += bocData[i].length;
  }
  return size;
}

// Print out the input KB/s from stdin.
/*var BYTES_PER_KILO = 1024;
setInterval(function() {
  var totalSeconds = ((new Date()) - startTime) / 1000;
  var kbps = (totalBytes / BYTES_PER_KILO) / totalSeconds;
  console.log(kbps);
}, 500);*/


var name = "TooTallNate's Pink Floyd Collection"
var metaint = 4096;
// Array of HttpServerResponse objects that are listening clients.
var clients = [];
// The max number of listening clients allowed at a time.
var maxClients = 15;

var currentTrack = "unknown";
var currentTrackStartTime;
var duration;
var dId;
stdin.on("metadata", function(metadata, dur) {
  currentTrack = metadata;
  console.error(("Received 'metadata' event: ".bold + currentTrack).blue);
  clients.forEach(function(client) {
    if (client instanceof icecast.IcecastWriteStack) {
      client.queueMetadata(currentTrack + (dur ? " (" + prettyPrintTime(0) + " / " + prettyPrintTime(dur) + ")" : ""));
    }
  });
  // If a duration was provided, then call setInterval to update the clients
  // of the progress throughout the track.
  // TODO: This should be based on the incoming 'totalBytes', instead of real time.
  if (dur) {
    if (dId) { clearInterval(dId); }
    currentTrackStartTime = new Date();
    duration = dur;
    dId = setInterval(function() {
      var secondsInto = ((new Date()) - currentTrackStartTime) / 1000;
      clients.forEach(function(client) {
        if (client instanceof icecast.IcecastWriteStack) {
          client.queueMetadata(currentTrack + " (" + prettyPrintTime(secondsInto) + " / " + prettyPrintTime(duration) + ")")
        }
      });
    }, 1000);
  }
});

// Now we create the HTTP server.
http.createServer(function(req, res) {

  // Does the client support icecast metadata?
  var acceptsMetadata = req.headers['icy-metadata'] == 1;

  if (req.url == "/stream.mp3") {
    
    // Sorry, too busy, try again later!
    if (clients.length >= maxClients) {
      res.writeHead(503);
      return res.end("The maximum number of clients ("+maxClients+") are aleady connected, try connecting again later...")
    }

    var headers = {
      "Content-Type": "audio/mpeg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = name;
      headers['icy-metaint'] = metaint;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, metaint);
      res.queueMetadata(currentTrack);
    }

    var mp3 = spawn("lame", [
      "-S", // Operate silently (nothing to stderr)
      "-r", // Input is raw PCM
      "-s", SAMPLE_RATE / 1000, // Input sampling rate: 44,100
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
      if (mp3.stdin.writable)
        mp3.stdin.write(chunk);
    }
    stdin.on("data", callback);
    clients.push(res);
    console.error((("New MP3 " + (acceptsMetadata ? "Icecast " : "") + "Client Connected: "+req.connection.remoteAddress+"!").bold + " Total " + clients.length).green);
    
    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      clients.splice(clients.indexOf(res), 1);
      stdin.removeListener("data", callback);
      mp3.kill();
      console.error((("MP3 " + (acceptsMetadata ? "Icecast " : "") + "Client Disconnected: "+req.connection.remoteAddress+" :(").bold + " Total " + clients.length).red);
    });

  // If "/stream.ogg" is requested, fire up an OGG encoder (oggenc), and start
  // streaming the OGG vorbis data to the client.
  } else if (req.url == "/stream.ogg") {

    // Sorry, too busy, try again later!
    if (clients.length >= maxClients) {
      res.writeHead(503);
      return res.end("The maximum number of clients ("+maxClients+") are aleady connected, try connecting again later...")
    }

    var headers = {
      "Content-Type": "application/ogg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = name;
      headers['icy-metaint'] = metaint;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, metaint);
      res.queueMetadata(currentTrack);
    }

    var ogg = spawn("oggenc", [
      "--silent", // Operate silently (nothing to stderr)
      "-r", // Raw input
      "--ignorelength", // Ignore length
      "--raw-rate=" + SAMPLE_RATE, // Raw input rate: 44100
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
      if (ogg.stdin.writable)
        ogg.stdin.write(chunk);
    }
    stdin.on("data", callback);
    clients.push(res);
    console.error((("New OGG " + (acceptsMetadata ? "Icecast " : "") + "Client Connected: "+req.connection.remoteAddress+"!").bold + " Total " + clients.length).green);

    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      clients.splice(clients.indexOf(res), 1);
      stdin.removeListener("data", callback);
      ogg.kill();
      console.error((("OGG " + (acceptsMetadata ? "Icecast " : "") + "Client Disconnected: "+req.connection.remoteAddress+" :(").bold + " Total " + clients.length).red);
    });

  // If "/metadata" is requested, then hold of on sending any response, but
  // request the `icecast.ReadStream` instance to notify the request of the next
  // 'metadata' event.
  } else if (req.url == "/metadata") {
    if (req.method == "POST") {
      var auth = req.headers.authorization;
      var ct = req.headers['x-current-track'];
      if (ct && auth && auth.substring(0, 6) == "Basic " &&
          Buffer(auth.substring(6),'base64').toString('ascii') == 'node:rules') {

        stdin.emit('metadata', ct.trim(), req.headers['x-duration']);
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(currentTrack)
        });
        res.end(currentTrack);
        
      } else {
        res.writeHead(401);
        res.end("Unauthorized");        
      }
    } else if (req.headers['x-current-track']) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(currentTrack)
      });
      res.end(currentTrack);
    } else {
      req.connection.setTimeout(0); // Disable timeouts
      stdin.once("metadata", function(metadata) {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(metadata)
        });
        res.end(metadata);
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

}).listen(5555, function() {
  console.error(("HTTP Icecast server listening at: ".bold + "http://*:" + this.address().port).cyan);
});

process.on('uncaughtException', function(e) {
  console.error("UNCAUGHT EXCEPTION:", e.message);
  console.error(e.stack);
});

// Takes a Number in seconds, and returns a String in format mm:ss.
// Used in metadata events to compatible clients (VLC).
function prettyPrintTime(seconds) {
  seconds = Number(seconds);
  var mins = Math.floor(seconds/60);
  var secs = seconds % 60;
  return mins + ":" + (secs < 10 ? "0":"") + Math.floor(secs);
}
