
/**
 * Module dependencies.
 */

var assert = require('assert');
var inherits = require('util').inherits;
var Transform = require('stream').Transform;
var debug = require('debug')('icecast:writer');

/**
 * Module exports.
 */

module.exports = Writer;

/**
 * The value of the metabyte on each pass is
 * "ceil(metadata.length / META_BLOCK_SIZE)".
 */

var META_BLOCK_SIZE = 16;

/**
 * 
 */

var NO_METADATA = new Buffer([0]);

/**
 * The `Writer` class is a duplex stream that accepts raw audio/video data and
 * passes it through untouched. It also has a `queueMetadata()` function that will
 * queue the Writer to inject the metadata into the stream at the next "metaint"
 * interval.
 *
 * @api public
 */

function Writer (metaint, opts) {
  if (!(this instanceof Writer)) {
    return new Writer(metaint, opts);
  }
  if (!isFinite(metaint)) {
    throw new Error('Writer requires a "metaint" number');
  }
  Transform.call(this, opts);
  this.metaint = +metaint;
  this.left = this.metaint;
}
inherits(Writer, Transform);

/**
 *
 */

Writer.prototype._transform = function (chunk, write, done) {
  debug('_transform: (chunk.length: %d)', chunk.length);
  assert(this.left > 0);
  if (chunk.length <= this.left) {
    // small buffer fits within the "left" window
    this._onRawData(chunk, write);
    done();
  } else {
    // large buffer needs to be spliced on "left" and processed
    var b = chunk.slice(0, this.left);
    this._onRawData(b, write);
    if (chunk.length > b.length) {
      this._transform(chunk.slice(b.length), write, done);
    }
  }
};

/**
 *
 */

Writer.prototype._onRawData = function (chunk, write) {
  debug('_onRawData: (chunk.length: %d)', chunk.length);
  write(chunk);
  this.left -= chunk.length;
  if (0 === this.left) {
    this._inject(write);
  }
};

/**
 * Writes the next "metabyte" to the output stream.
 */

Writer.prototype._inject = function (write) {
  var buffer;
  if (0 === this._queue.length) {
    buffer = NO_METADATA;
  } else {
    buffer = this._queue.shift();
  }
  write(buffer);
  this.left = this.metaint;
};
