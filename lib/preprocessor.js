
/**
 * Module dependencies.
 */

var assert = require('assert');
var hijack = require('event-hijack');
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

function preprocessor (stream) {
  debug('setting up "data" preprocessor');
  stream._icyDone = false;

  var emitData = hijack(stream, 'data', function (chunk) {
    debug('onData (chunk.length: %d)', chunk.length);

    if (!this._icyDone) {
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
        this._wasIcy = true;
      } else {
        this._wasIcy = false;
      }
      this._icyDone = true;
    }

    emitData(chunk);
  });
}
