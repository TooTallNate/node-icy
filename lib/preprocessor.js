
/**
 * Module dependencies.
 */

var assert = require('assert');
var debug = require('debug')('icecast:preprocessor');

/**
 * Module exports.
 */

module.exports = preprocessor;

/**
 * The fake HTTP version to write when an "ICY" version is encountered.
 */

var HTTP10 = new Buffer('HTTP/1.0');

/**
 * This all really... really.. sucks...
 */

function preprocessor (socket) {
  debug('setting up "data" preprocessor');

  function ondata (chunk) {
    // TODO: don't be lazy, buffer if needed...
    assert(chunk.length >= 3, 'buffer too small! ' + chunk.length);
    if (/icy/i.test(chunk.slice(0, 3))) {
      debug('got ICY response!');
      var b = new Buffer(chunk.length + HTTP10.length - 'icy'.length);
      var i = 0;
      i += HTTP10.copy(b);
      i += chunk.copy(b, i, 3);
      assert.equal(i, b.length);
      chunk = b;
      socket._wasIcy = true;
    } else {
      socket._wasIcy = false;
    }

    return chunk;
  }

  if ('function' == typeof socket.ondata) {
    // node < v0.11.3
    var origOnData = socket.ondata;
    socket.ondata = function (buf, start, length) {
      var chunk = ondata(buf.slice(start, length));

      // now clean up and inject the modified `chunk`
      socket.ondata = origOnData;
      socket.ondata(chunk, 0, chunk.length);
    };
  } else if ('function' == typeof socket.read) {
    // node >= v0.11.3

  } else {
    // never?
    throw new Error('should not happen...');
  }
}
