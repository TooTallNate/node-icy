
/**
 * Module dependencies.
 */

var Transform = require('stream').Transform;
var debug = require('debug')('icecast:reader');
var inherits = require('util').inherits;
var assert = require('assert');

/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The 3 states of the parser.
 *   normal - parsing raw data that should be passed through untouched
 *   metabyte - parsing the metadata byte (length of 1)
 *   metadata - parsing the metadata itself
 */

var STATES = {
  NORMAL: 0,
  METABYTE: 1,
  METADATA: 2
};

/**
 * On the meta-length byte, you must multiply/divide by META_BLOCK_SIZE
 * to get the real metadata byte-length.
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
    throw new Error('Reader requires a "metaint" number');
  }
  Transform.call(this, opts);
  this.metaint = +metaint;
  this.left = this.metaint;
  this._state = STATES.NORMAL;
  debug('created new Reader instance with "metaint": %d', this.metaint);
}
inherits(Reader, Transform);

/**
 * This function's job is to call _onData() with chunks that begin/end on
 * boundaries when appropriate.
 */

Reader.prototype._transform = function (chunk, write, done) {
  debug('_transform: (chunk.length: %d)', chunk.length);
  assert(this.left > 0);
  if (chunk.length <= this.left) {
    // small buffer fits within the "left" window
    this._onData(chunk, write);
    done();
  } else {
    // large buffer needs to be spliced on "left" and processed
    var b = chunk.slice(0, this.left);
    this._onData(b, write);
    if (chunk.length > b.length) {
      this._transform(chunk.slice(b.length), write, done);
    }
  }
};

/**
 * Called for each "data" chunk.
 */

Reader.prototype._onData = function (chunk, write) {
  debug('_onData: (chunk.length: %d) (state: %d)', chunk.length, this._state);
  this.left -= chunk.length;
  switch (this._state) {
    case STATES.NORMAL:
      this._onRawData(chunk, write);
      break;
    case STATES.METABYTE:
      this._onMetaByte(chunk);
      break;
    case STATES.METADATA:
      this._onMetaData(chunk);
      break;
    default:
      this.emit('error', new Error('unkown state: ' + this._state));
  }
};

/**
 * Called when in the "normal" state.
 */

Reader.prototype._onRawData = function (chunk, write) {
  write(chunk);
  if (0 === this.left) {
    this._state = STATES.METABYTE;
    this.left = 1; // the metabyte is just 1 byte...
  }
};

/**
 * Called during the "metabyte" state.
 *
 * @api private
 */

Reader.prototype._onMetaByte = function (chunk) {
  assert(this.left === 0);
  assert(chunk.length === 1);
  var length = chunk[0] * META_BLOCK_SIZE;
  debug('_onMetaByte: metabyte: %d, metalength: %d', chunk[0], length);
  if (length > 0) {
    // we have metadata to parse
    this.left = length;
    this._state = STATES.METADATA;
    this._bufferedLength = 0;
    this._buffers = [];
  } else {
    // not metadata this time around, back to serving raw data chunks
    this.left = this.metaint;
    this._state = STATES.NORMAL;
  }
};

/**
 * Called during the "metadata" state. This function buffers the given chunks
 * until "left" === 0, upon which the "metadata" event gets fired with a Buffer
 * containing the metadata contents.
 *
 * @api private
 */

Reader.prototype._onMetaData = function (chunk) {
  debug('_onMetaData (chunk.length: %d)', chunk.length);
  this._buffers.push(chunk);
  this._bufferedLength += chunk.length;

  if (this.left === 0) {
    this.emit('metadata', Buffer.concat(this._buffers, this._bufferedLength));
    // clean up buffers
    this._buffers = this._bufferedLength = null;
    // back to "normal" state
    this.left = this.metaint;
    this._state = STATES.NORMAL;
  }
};
