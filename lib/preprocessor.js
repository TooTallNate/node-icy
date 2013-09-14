
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

  var listeners;
  function icecastOnData (buf) {
    var chunk = ondata(buf);

    // clean up, and re-emit "data" event
    socket.removeListener('data', icecastOnData);
    listeners.forEach(function (listener) {
      socket.on('data', listener);
    });
    listeners = null;
    socket.emit('data', chunk);
  }

  if ('function' == typeof socket.ondata) {
    // node < v0.11.3, the `ondata` function is set on the socket
    var origOnData = socket.ondata;
    socket.ondata = function (buf, start, length) {
      var chunk = ondata(buf.slice(start, length));

      // now clean up and inject the modified `chunk`
      socket.ondata = origOnData;
      origOnData = null;
      socket.ondata(chunk, 0, chunk.length);
    };
  } else if (socket.listeners('data').length > 0) {
    // node >= v0.11.3, the "data" event is listened for directly

    // add our own "data" listener, and remove all the old ones
    listeners = socket.listeners('data');
    socket.removeAllListeners('data');
    socket.on('data', icecastOnData);
  } else {
    // never?
    throw new Error('should not happen...');
  }
}
