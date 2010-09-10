node-radio-stream
=================
### Internet Radio (SHOUTcast, Icecast) Proxy for [NodeJS][]

This module acts offers an interface for proxying the raw audio data and
parsing the metadata from an [SHOUTcast][] or [Icecast][] broadcast. The
exposed API is offered as a `ReadStream` for compatibility and flexibility
with Node's other Stream interfaces.


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
metadata and it is impossible to extract. But a WebSocket connection could
be used in conjunction with this module to provide those `metadata` events
to a web browser, for instance.


Installation
------------

This will be available through `npm` once it reaches a stable state. While
alpha, you can currently just download this git repo:

    git clone git://github.com/TooTallNate/node-radio-stream.git


[NodeJS]: http://nodejs.org
[SHOUTcast]: http://www.shoutcast.com/
[Icecast]: http://icecast.org/
