
/**
 * Module dependencies.
 */

var Client = require('./client');

/**
 * Module exports.
 */

module.exports = request;

/**
 * `request()` convenience function. Similar to node core's `http.request()`,
 * except it returns an `icecast.Client` instance.
 *
 * @param {Object} options connection info and options object
 * @param {Function} cb optional callback function for the "response" event
 * @api public
 */

function request (options, fn) {
  return new Client(options, fn);
};
