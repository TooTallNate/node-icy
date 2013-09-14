
/**
 * Module dependencies.
 */

var net = require('net');
var url = require('url');
var http = require('http');
var Reader = require('./reader');
var preprocess = require('./preprocessor');
var debug = require('debug')('icecast:client');

/**
 * Module exports.
 */

exports = module.exports = Client;

/**
 * The `Client` class is a subclass of the `http.ClientRequest` object.
 *
 * It adds a stream preprocessor to make "ICY" responses work. This is only needed
 * because of the strictness of node's HTTP parser. I'll volley for ICY to be
 * supported (or at least configurable) in the http header for the JavaScript
 * HTTP rewrite (v0.12 of node?).
 *
 * The other big difference is that it passes an `icecast.Reader` instance
 * instead of a `http.ClientResponse` instance to the "response" event callback,
 * so that the "metadata" events are automatically parsed and the raw audio stream
 * it output without the Icecast bytes.
 *
 * Also see the [`request()`](#request) and [`get()`](#get) convenience functions.
 *
 * @param {Object} options connection info and options object
 * @param {Function} cb optional callback function for the "response" event
 * @api public
 */

function Client (options, cb) {
  if ('string' == typeof options) {
    options = url.parse(options);
  }

  var req = http.request(options);

  // add the "Icy-MetaData" header
  req.setHeader('Icy-MetaData', '1');

  if ('function' == typeof cb) {
    req.once('icecastResponse', cb);
  }

  req.once('response', icecastOnResponse);
  req.once('socket', icecastOnSocket);

  return req;
};

/**
 * "response" event listener.
 *
 * @api private
 */

function icecastOnResponse (res) {
  debug('request "response" event');

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
 * "socket" event listener.
 *
 * @api private
 */

function icecastOnSocket (socket) {
  debug('request "socket" event');

  // we have to preprocess the stream (that is, intercept "data" events and
  // emit our own) to make the invalid "ICY" HTTP version get translated into
  // "HTTP/1.0"
  preprocess(socket);
}

/**
 * Proxies "key" from `stream` to `stream.res`.
 *
 * @api private
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
