node-icecast-stack
==================
### A [StreamStack][] implementation for parsing and/or injecting metadata with SHOUTcast/Icecast radio streams.

This module offers an interface for retrieving the raw audio data and
parsing the metadata from a [SHOUTcast][] or [Icecast][] broadcast. Two API's
are offered: a low-level [StreamStack][] read and write interface (which
requires you to establish the connection to the `net.Stream` yourself), and a
more convenient high-level
[ReadStream](http://nodejs.org/api.html#readable-stream-23) interface (which
creates a `net.Stream` connection, and uses the `StreamStack` interfaces
transparently).


Usage
-----

Here's a basic example of just piping the clean audio data to _stdout_,
while printing the HTTP response headers and metadata events to _stderr_:

    var icecast = require('icecast-stack');

    var url = 'http://67.205.85.183:7714'; // URL to a known Icecast stream
    var stream = icecast.createReadStream(url);

    // Fired when the `net.Stream` has it's 'connect' event.
    stream.on('connect', function() {
      console.error("Radio Stream connected!");
    });
    
    // Fired after the HTTP response headers have been received.
    stream.on('response', function(res) {
      console.error("Radio Stream response!");
      console.error(res.headers);
    });

    // When a 'metadata' event happens, usually a new song is starting.
    stream.on('metadata', function(metadata) {
      var title = icecast.parseMetadata(metadata).StreamTitle;
      console.error(title);
    });

    // Proxy the raw audio stream to 'stdout', redirect to a file!
    stream.pipe(process.stdout);

Look in the `examples` directory for code of some more complex use-cases.

The most important use case of this is for HTML5 web apps that listen to
radio streams; the `<audio>` tag doesn't know how to deal with the extra
metadata and it is impossible to extract (on the client-side). But a
WebSocket connection could be used in conjunction with this module to provide
those `metadata` events to a web browser, for instance.


Installation
------------

Installation through [__npm__](http://github.com/isaacs/npm) is the most
straight-forward way to install the `node-icecast-stack` module:

    npm install icecast-stack

Or just checking out this _git_ repo works as well:

    git clone git://github.com/TooTallNate/node-icecast-stack.git


[NodeJS]: http://nodejs.org
[StreamStack]: http://github.com/TooTallNate/node-stream-stack
[SHOUTcast]: http://www.shoutcast.com/
[Icecast]: http://icecast.org/
