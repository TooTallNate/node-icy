/**
 * This example script demonstrates a basic proxy of the audio and metadata
 * through a Node HTTP server. The command-line tools `lame` and `oggenc` are
 * required for this to work. Invoking this script will start the HTTP server
 * on port 36867. If the browser requests:
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

// If you pass a URL to a SHOUTcast/Icecast stream, then we'll use that,
// otherwise get a random one from the "radioStations.json" file.
var station = process.argv[2] || require("../radioStations").random().url;
console.error("Connecting to: " + station);

// Connect to the remote radio stream, and pass the raw audio data to any
// client requesting the "/stream" URL (will be an <audio> tag).
var stream = radio.createReadStream(station);

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

// Now we create the HTTP server.
var httpPort = 36867;
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

  } else if (req.url == "/stream.mp3") {
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Connection": "close",
        "Transfer-Encoding": "identity"
      });
      var mp3 = spawn("lame", [
        "-S", "-r", "-s", "48", "-", "-"
      ]);
      var callback = function(chunk) {
        mp3.stdin.write(chunk);
      }
      mp3.stdout.on("data", function(chunk) {
        res.write(chunk);
      });
      pcm.stdout.on("data", callback);
      req.connection.on("close", function() {
        // This occurs when the HTTP client closes the connection.
        pcm.stdout.removeListener("data", callback);
        mp3.kill();
      });      
 
  } else if (req.url == "/stream.ogg") {
      res.writeHead(200, {
        "Content-Type": "application/ogg",
        "Connection": "close",
        "Transfer-Encoding": "identity"
      });
      var ogg = spawn("oggenc", [
        "--silent", // Silent operation
        "-r", // Raw input
        "--ignorelength", // Ignore length
        "--raw-rate=48000", // Raw input rate: 48000
        "-" // Input from stdin, Output to stderr
      ]);
      var callback = function(chunk) {
        ogg.stdin.write(chunk);
      }
      ogg.stdout.on("data", function(chunk) {
        res.write(chunk);
      });
      pcm.stdout.on("data", callback);
      req.connection.on("close", function() {
        // This occurs when the HTTP client closes the connection.
        pcm.stdout.removeListener("data", callback);
        ogg.kill();
      });      
 
  } else if (req.url == "/metadata") {
    req.connection.setTimeout(0); // Disable timeouts
    var callback = function(metadata) {
      stream.removeListener("metadata", callback);
      res.writeHead(200, {
        'Content-Type':'application/json'
      });
      res.end(radio.parseMetadata(metadata).StreamTitle);
    }
    stream.on("metadata", callback);
  } else {
    fs.readFile(__dirname + "/index.html", function(err, buffer) {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': buffer.length
      });
      res.end(buffer);
    });
  }
}).listen(httpPort, function() {
  console.error("HTTP server started on port: " + httpPort);
});

