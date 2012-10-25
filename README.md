node-icecast
============
### NodeJS module for parsing and/or injecting metadata into SHOUTcast/Icecast radio streams

This module offers a `Reader` class for retrieving the raw audio data and
parsing the metadata from a [SHOUTcast][] or [Icecast][] broadcast.

There's also a `Writer` class that allows you to inject your own metadata into a
data stream, which can then be displayed by another Icecast client (like VLC).

But you'll probably be most interested in the `Client` class that builds off of
node's core `http` module, except this version works with servers that return
an **ICY** HTTP version, and automatically sends an "Icy-MetaData: 1" HTTP header
to notify the server that we want metadata, and finally it returns a `Reader`
instance in the "response" event, therefore the "res" object also emits "metadata"
events. See the example below to see how it works.

A good use case for this module is for HTML5 web apps that host to radio streams;
the `<audio>` tag doesn't know how to deal with the extra metadata and it is
impossible to extract (on the client-side). But a WebSocket connection could be
used in conjunction with this module to provide those `metadata` events to a
web browser, for instance.

Installation
------------

Install with `npm`:

``` bash
$ npm install icecast
```


Example
-------

Here's a basic example of using the HTTP `Client` to connect to a remote Icecast
stream, pipe the clean audio data to _stdout_, and print the HTTP response headers
and metadata events to _stderr_:

``` javascript
var icecast = require('icecast');

// URL to a known Icecast stream
var url = 'http://radio.nugs.net:8002';

// connect to the remote stream
icecast.get(url, function (res) {

  // log the HTTP response headers
  console.error(res.headers);

  // log any "metadata" events that happen
  res.on('metadata', function (metadata) {
    var parsed = icecast.parse(metadata);
    console.error(parsed);
  });

  // pipe the audio data to `stdout`
  res.pipe(process.stdout);
});
```


API
---

### `Client` class

### `Reader` class

### `Writer` class

### `request()` function

### `get()` function

### `parse()` function

### `stringify()` function


[NodeJS]: http://nodejs.org
[Icecast]: http://icecast.org
[SHOUTcast]: http://www.shoutcast.com
