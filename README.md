node-icecast
============
### NodeJS module for parsing and/or injecting metadata into SHOUTcast/Icecast radio streams
[![Build Status](https://secure.travis-ci.org/TooTallNate/node-icecast.png)](http://travis-ci.org/TooTallNate/node-icecast)

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
var lame = require('lame');
var icecast = require('icecast');
var Speaker = require('speaker');

// URL to a known Icecast stream
var url = 'http://firewall.pulsradio.com';

// connect to the remote stream
icecast.get(url, function (res) {

  // log the HTTP response headers
  console.error(res.headers);

  // log any "metadata" events that happen
  res.on('metadata', function (metadata) {
    var parsed = icecast.parse(metadata);
    console.error(parsed);
  });

  // Let's play the music (assuming MP3 data).
  // lame decodes and Speaker sends to speakers!
  res.pipe(new lame.Decoder())
     .pipe(new Speaker());
});
```


API
---

  - [Client()](#client)
  - [request()](#request)
  - [get()](#get)
  - [Reader()](#reader)
  - [Writer()](#writer)
    - [.queue()](#writerqueuemetadata)
  - [parse()](#parse)
  - [stringify()](#stringify)

## Client()

The `Client` class is a subclass of the `http.ClientRequest` object.

It adds a stream preprocessor to make "ICY" responses work. This is only needed
because of the strictness of node's HTTP parser. I'll volley for ICY to be
supported (or at least configurable) in the http header for the JavaScript
HTTP rewrite (v0.12 of node?).

The other big difference is that it passes an `icecast.Reader` instance
instead of a `http.ClientResponse` instance to the "response" event callback,
so that the "metadata" events are automatically parsed and the raw audio stream
it output without the Icecast bytes.

Also see the [`request()`](#request) and [`get()`](#get) convenience functions.

## request()

`request()` convenience function. Similar to node core's
[`http.request()`](http://nodejs.org/docs/latest/api/http.html#http_http_request_options_callback),
except it returns an `icecast.Client` instance.

## get()

`get()` convenience function. Similar to node core's
[`http.get()`](http://nodejs.org/docs/latest/api/http.html#http_http_get_options_callback),
except it returns an `icecast.Client` instance with `.end()` called on it and
no request body written to it (the most common scenario).

## Reader()

Icecast stream reader. This is a duplex stream that emits "metadata" events in
addition to stripping out the metadata itself from the output data. The result
is clean (audio and/or video) data coming out of the stream.

## Writer()

The `Writer` class is a duplex stream that accepts raw audio/video data and
passes it through untouched. It also has a `queue()` function that will
queue the Writer to inject the metadata into the stream at the next "metaint"
interval.

### Writer#queue(metadata)

Queues a piece of metadata to be sent along with the stream.
`metadata` may be a String and be any title (up to 4066 chars),
or may be an Object containing at least a "StreamTitle" key, with a String
value. The serialized metadata payload must be <= 4080 bytes.

## parse()

Parses a Buffer (or String) containing Icecast metadata into an Object.

## stringify()

Takes an Object and converts it into an Icecast metadata string.

[NodeJS]: http://nodejs.org
[Icecast]: http://icecast.org
[SHOUTcast]: http://www.shoutcast.com
