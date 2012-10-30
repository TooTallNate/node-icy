
/**
 * Module dependencies.
 */

var net = require('net');
var url = require('url');
var http = require('http');
var assert = require('assert');
var inherits = require('util').inherits;
var debug = require('debug')('icecast:client');
var Reader = require('./reader');
var preprocess = require('./preprocessor');

/**
 * Module exports.
 */

exports = module.exports = Client;

/**
 * The `Client` class is a subclass of the `http.ClientRequest` object.
 *
 * It adds a stream preprocessor to make "ICY" responses work. This is only needed
 * because of the strictness of node's HTTP parser. I'll volley for ICY to be
 * supported in the http header for the JavaScript HTTP rewrite (v0.12 of node?).
 *
 * The other big difference is that it passes a `icecast.Reader` instance instead
 * of a `http.ClientResponse` instance to the "response" event callback.
 */

function Client (options, cb) {
  if (!(this instanceof Client)) {
    return new Client(options, cb);
  }

  if (typeof options === 'string') {
    options = url.parse(options);
  }

  if (options.protocol && options.protocol !== 'http:') {
    throw new Error('Protocol:' + options.protocol + ' not supported.');
  }

  // TODO: extend instead of mutating the opts directly
  options.createConnection = createConnection;

  // add the "Icy-MetaData" header
  if (!options.headers) options.headers = {};
  options.headers['Icy-MetaData'] = 1;

  // force a new http.Agent instance by default
  if (!options.agent) {
    options.agent = new http.Agent();
    options.agent.createConnection = createConnection;
  }

  http.ClientRequest.call(this, options, onResponse);

  this.realOn = this.on;
  this.on = this.addListener = on;
  // TODO: overwrite removeListener

  if ('function' == typeof cb) {
    this.on('response', cb);
  }
}
inherits(Client, http.ClientRequest);

/**
 * The overwritten "on" function translates new "response" events into
 * "icecastResponse".
 */

function on (name, fn) {
  debug('on: %s', name);
  if ('response' == name) {
    debug('remapping as "icecastResponse" listener', fn);
    name = 'icecastResponse';
  }
  return this.realOn(name, fn);
}

/**
 * The "response" event callback.
 */

function onResponse (res) {
  debug('onResponse');
  var s = res;
  var metaint = res.headers['icy-metaint'];
  if (metaint) {
    debug('got metaint: %d', metaint);
    s = new Reader(metaint);
    res.pipe(s);

    s.res = res;

    Object.keys(res).forEach(function (k) {
      if ('_' === k[0]) return;
      debug('proxying %j', k);
      proxy(s, k);
    });
  }
  if (res.connection._wasIcy) {
    s.httpVersion = 'ICY';
  }
  this.emit('icecastResponse', s);
}

/**
 * Proxies "key" from `stream` to `stream.res`.
 */

function proxy (stream, key) {
  if (key in stream) {
    debug('not proxying prop "%s" because it already exists on target stream', key);
    return;
  }

  function get () {
    return stream.res[key];
  }
  function set (v) {
    return stream.res[key] = v;
  }
  Object.defineProperty(stream, key, {
    configurable: true,
    enumerable: true,
    get: get,
    set: set
  });
}

/**
 * This block mostly coped from the "https" core module. What a mess...
 *
 * This function creates a regular net connection to the destination, but returns
 * a Preprocessor stream that basically does this s/^ICY/HTTP\\1\.0/i, because of
 * node's strict HTTP parser.
 */

function createConnection(/* [port, host, options] */) {
  var options = {};

  if (typeof arguments[0] === 'object') {
    options = arguments[0];
  } else if (typeof arguments[1] === 'object') {
    options = arguments[1];
    options.port = arguments[0];
  } else if (typeof arguments[2] === 'object') {
    options = arguments[2];
    options.port = arguments[0];
    options.host = arguments[1];
  } else {
    if (typeof arguments[0] === 'number') {
      options.port = arguments[0];
    }
    if (typeof arguments[1] === 'string') {
      options.host = arguments[1];
    }
  }

  // TODO: SSL support? (I haven't found any streams that support that, but
  // node-icecast's `Server` could do that...)
  var stream = net.createConnection(options);

  // we have to preprocess the stream (that is, intercept "data" events and emit
  // our own) to make the invalid "ICY" http version get translated into
  // "HTTP/1.0"
  preprocess(stream);

  return stream;
}
