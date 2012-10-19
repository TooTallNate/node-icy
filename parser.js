
/**
 * Module dependencies.
 */

var assert = require('assert');
var inherits = require('util').inherits;
var Transform = require('stream').Transform;
var debug = require('debug')('stream:parser');

// for node v0.8.x support, remove after v0.12.x
if (!Transform) Transform = require('readable-stream/transform');

/**
 * Module exports.
 */

module.exports = Parser;

/**
 * Abstraction on top of the `Transform` base Stream class. Offers:
 *
 *   buffer(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
 *   passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
 */

function Parser (opts) {
  Transform.call(this, opts);
  this._left = 0;
  this._buffers = [];
  this._buffered = 0;
  this._buffering = false;
}
inherits(Parser, Transform);

/**
 * Buffers "n" bytes and then invokes "cb" once that amount is satisfied.
 */

Parser.prototype.buffer = function (n, cb) {
  assert(!this._cb, 'There is already a "callback" set!');
  assert(isFinite(n), 'Can only buffer a finite number of bytes, got "' + n + '"');
  debug('buffering "%d" bytes', n);
  this._left = n;
  this._cb = cb;
  this._buffering = true;
};

/**
 * Passes through "n" bytes to the readable side of this stream, then invokes "cb"
 * once that amount is satisfied.
 */

Parser.prototype.passthrough = function (n, cb) {
  assert(!this._cb, 'There is already a "callback" set!');
  debug('passing through "%d" bytes', n);
  this._left = n;
  this._cb = cb;
  this._buffering = false;
};

/**
 * The internal buffering/passthrough logic...
 */

Parser.prototype._transform = function (chunk, write, done) {
  debug('_transform: (chunk.length: %d)', chunk.length);
  if (this.done) {
    debug('_transform called, but stream is "done"!');
    return done();
  }
  assert(this._left > 0);
  if (chunk.length <= this._left) {
    // small buffer fits within the "_left" window
    this._onData(chunk, write);
    done();
  } else {
    // large buffer needs to be sliced on "_left" and processed
    var b = chunk.slice(0, this._left);
    this._onData(b, write);
    if (chunk.length > b.length) {
      this._transform(chunk.slice(b.length), write, done);
    }
  }
};

Parser.prototype._onData = function (chunk, write) {
  this._left -= chunk.length;
  if (this._buffering) {
    // buffer
    this._buffers.push(chunk);
    this._buffered += chunk.length;
  } else {
    // passthrough
    write(chunk);
  }

  if (0 === this._left) {
    // done with this "piece", invoke the callback
    var cb = this._cb;
    if (cb && this._buffering && this._buffers.length > 1) {
      chunk = Buffer.concat(this._buffers, this._buffered);
    }
    if (!this._buffering) {
      chunk = null;
    }
    this._cb = null;
    this._buffered = 0;
    this._buffering = true;
    this._buffers.splice(0); // empty
    if (cb) {
      if (chunk) {
        cb.call(this, chunk, write); // buffered
      } else {
        cb.call(this, write); // passthrough
      }
    }
    assert(this.done || this._left > 0, 'buffer() or passthrough() were not called in the callback');
  }
};
