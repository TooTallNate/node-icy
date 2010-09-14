node-radio-stream
=================
### A [NodeJS][] interface for connecting to, parsing metadata, and reading from SHOUTcast/Icecast radio streams.

This module offers an interface for retrieving the raw audio data and
parsing the metadata from an [SHOUTcast][] or [Icecast][] broadcast. The
exposed API is offered as a [ReadStream](http://nodejs.org/api.html#readable-stream-22)
for compatibility and flexibility with [Node][NodeJS]'s other `Stream` interfaces.


Usage
-----

Here's a basic example of just piping the clean audio data to _stdout_,
while printing the HTTP response headers and metadata events to _stderr_:

    var radio = require("radio-stream");

    var stream = radio.createReadStream(url);

    stream.on("connect", function() {
      console.error("Radio Stream connected!");
      console.error(stream.headers);
    });
    stream.on("data", function(chunk) {
      process.stdout.write(chunk);
    });
    stream.on("metadata", function(title) {
      console.error(title);
    });

Look in the `examples` directory for code of some more complex use-cases.

The most important use case of this is for HTML5 web apps that listen to
radio streams; the `<audio>` tag doesn't know how to deal with the extra
metadata and it is impossible to extract (on the client-side). But a
WebSocket connection could be used in conjunction with this module to provide
those `metadata` events to a web browser, for instance.


Installation
------------

Installation through [__npm__](http://github.com/isaacs/npm) is the most
straight-forward way to install the `node-radio-stream` module:

    npm install radio-stream

Or just checking out this _git_ repo works as well:

    git clone git://github.com/TooTallNate/node-radio-stream.git


[NodeJS]: http://nodejs.org
[SHOUTcast]: http://www.shoutcast.com/
[Icecast]: http://icecast.org/
