
/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('../parser');
var inherits = require('util').inherits;
var debug = require('debug')('icecast:reader');

/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The metabyte must multiply by META_BLOCK_SIZE to get the real metadata
 * byte-length.
 */

var META_BLOCK_SIZE = 16;

/**
 * Icecast stream reader. This is a duplex stream that emits "metadata" events in
 * addition to stripping out the metadata itself from the output data. The result
 * is clean (audio and/or video) data coming out of the stream.
 *
 * @api public
 */

function Reader (metaint, opts) {
  if (!(this instanceof Reader)) {
    return new Reader(metaint, opts);
  }
  if (!isFinite(metaint)) {
    throw new TypeError('Reader requires a "metaint" number');
  }
  Parser.call(this, opts);
  this.metaint = +metaint;
  this.passthrough(this.metaint, this._onRawData);
  debug('created new Reader instance with "metaint": %d', this.metaint);
}
inherits(Reader, Parser);

/**
 * Called after "metaint" bytes have been passed through.
 *
 * @api private
 */

Reader.prototype._onRawData = function () {
  debug('_onRawData()');
  this.buffer(1, this._onMetaByte);
};

/**
 * Called when the "metabyte" has been received.
 *
 * @api private
 */

Reader.prototype._onMetaByte = function (chunk) {
  assert(chunk.length === 1);
  var length = chunk[0] * META_BLOCK_SIZE;
  debug('_onMetaByte: metabyte: %d, metalength: %d', chunk[0], length, chunk);
  if (length > 0) {
    // we have metadata to parse
    this.buffer(length, this._onMetaData);
  } else {
    // not metadata this time around, back to serving raw data chunks
    this.passthrough(this.metaint, this._onRawData);
  }
};

/**
 * Called once all the metadata has been buffered for this pass.
 *
 * @api private
 */

Reader.prototype._onMetaData = function (chunk) {
  debug('_onMetaData (chunk.length: %d)', chunk.length);
  this.emit('metadata', chunk);
  this.passthrough(this.metaint, this._onRawData);
};
