
/**
 * Parse and stringify metadata Buffers to/from formatted Objects.
 */

exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');

/**
 * Low level transformation classes.
 */

exports.Reader = require('./lib/reader');
exports.Writer = require('./lib/writer');

/**
 * Icecast HTTP client interface. Extends the core "http" module's client
 * interface with "ICY" support, and the `res` emits "metadata" events.
 */

exports.Client = require('./lib/client');
exports.request = function (options, fn) {
  return new exports.Client(options, fn);
};
exports.get = function (options, fn) {
  var req = exports.request(options, fn);
  req.end();
  return req;
};
