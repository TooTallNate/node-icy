
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

function preprocessor (stream) {
  // TODO: support new stream API once node's net.Socket supports it
  stream.on('data', onData);
  stream.realOn = stream.on;
  stream.on = stream.addListener = on;
  stream.realRemoveListener = stream.removeListener;
  stream.removeListener = removeListener;
  Object.defineProperty(stream, 'ondata', {
    set: setOnData
  });
}

/**
 * This should be the *only* data listener on the "stream".
 */

function onData (chunk) {
  debug('onData (chunk.length: %d)', chunk.length);
  if (!this._preprocessedDone) {
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
    this._preprocessedDone = true;
  }
  this.emit('processedData', chunk);
}

function setOnData (v) {
  debug('set "ondata": %s', v && v.name);
  if (this._preprocessedOnData) {
    this.removeListener('data', this._preprocessedOnDataListener);
    this._preprocessedOnData = null;
    this._preprocessedOnDataListener = null;
  }
  if (v) {
    this._preprocessedOnDataListener = function (chunk) {
      this._preprocessedOnData(chunk, 0, chunk.length);
    };
    this.on('data', this._preprocessedOnDataListener);
  }
  return this._preprocessedOnData = v;
}

/**
 * Overwrite the "on" function to rewrite "data" events to "processedData".
 */

function on (name, fn) {
  debug('on: %s', name);
  if ('data' == name) {
    debug('remapping as "processedData" listener', fn);
    name = 'processedData';
  }
  return this.realOn(name, fn);
}

/**
 * Rewrites "data" listeners as "processedData".
 */

function removeListener (name, fn) {
  debug('removeListener: %s', name);
  if ('data' == name) {
    debug('remapping as "processedData" listener', fn);
    name = 'processedData';
  }
  return this.realRemoveListener(name, fn);
}
