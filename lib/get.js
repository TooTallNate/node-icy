/**
 * Module dependencies.
 */

var request = require('./request');

/**
 * Module exports.
 */

module.exports = get;

/**
 * `get()` convenience function. Similar to node core's
 * [`http.get()`](http://nodejs.org/docs/latest/api/http.html#http_http_get_options_callback),
 * except it returns an `icecast.Client` instance with `.end()` called on it and
 * no request body written to it (the most common scenario).
 *
 * @param {Object} options connection info and options object
 * @param {Function} cb optional callback function for the "response" event
 * @api public
 */

function get (options, fn) {
  var req = request(options, fn);
  req.end();
  return req;
};
