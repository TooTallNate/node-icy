/**
 * This example script demonstrates a basic proxy of the audio and metadata
 * through a Node HTTP server. Invoking this script will start the HTTP server
 * on port 36867. If the browser requests:
 *
 *    "/"         - The index page will be returned.
 *    "/stream"   - A radio station will be connected to, and audio data will
 *                  be sent back over to the HTTP client indefinitely.
 *    "/metadata" - A long-polling URI, which will return the value of the
 *                  metadata when a 'metadata' event happens on the
 *                  associated Audio stream.
 *   Usage:
 *     node examples/proxy.js [URL of Icecast Stream to proxy]
 */
var fs = require("fs");
var http = require("http");
var radio = require("../../lib/radio-stream");

// If you pass a URL to a SHOUTcast/Icecast stream, then we'll use that,
// otherwise get a random one from the "radioStations.json" file.
var station = process.argv[2] || require("../radioStations").random().url;
console.error("Connecting to: " + station);

// Connect to the remote radio stream, and pass the raw audio data to any
// client requesting the "/stream" URL (will be an <audio> tag).
var stream = radio.createReadStream(station);

// Now we create the HTTP server.
var httpPort = 36867;
http.createServer(function(req, res) {
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
      stream.on("data", callback);
      req.connection.on("close", function() {
        // This occurs when the HTTP client closes the connection.
        stream.removeListener("data", callback);
      });      
    }
    if (stream.connected) {
      connected();
    } else {
      stream.on("connect", connected);
    }
  } else if (req.url == "/metadata") {
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
