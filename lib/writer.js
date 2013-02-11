
/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('stream-parser');
var stringify = require('./stringify');
var inherits = require('util').inherits;
var Transform = require('stream').Transform;
var debug = require('debug')('icecast:writer');

// for node v0.8.x support, remove after v0.12.x
if (!Transform) Transform = require('readable-stream/transform');

/**
 * Module exports.
 */

module.exports = Writer;

/**
 * The value of the metabyte on each pass is
 * "ceil(metadata.length / META_BLOCK_SIZE)".
 *
 * @api private
 */

var META_BLOCK_SIZE = 16;

/**
 * The maximum byte length of a metadata chunk.
 *
 * @api private
 */

var MAX_LENGTH = META_BLOCK_SIZE * 255;

/**
 * Usually, the "metabyte" will just be 1 NUL byte, because there is no metadata
 * to be sent. Create that 1-byte buffer up-front.
 *
 * @api private
 */

var NO_METADATA = new Buffer([0]);

/**
 * The `Writer` class is a duplex stream that accepts raw audio/video data and
 * passes it through untouched. It also has a `queue()` function that will
 * queue the Writer to inject the metadata into the stream at the next "metaint"
 * interval.
 *
 * @param {Number} metaint the number of raw bytes that should be placed in between "metadata" blocks.
 * @param {Object} opts optional options object
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

  this._queue = [];

  this._passthrough(this.metaint, this._inject);
}
inherits(Writer, Transform);

/**
 * Mixin `Parser`.
 */

Parser(Writer.prototype);

/**
 * Queues a piece of metadata to be sent along with the stream.
 * `metadata` may be a String and be any title (up to 4066 chars),
 * or may be an Object containing at least a "StreamTitle" key, with a String
 * value. The serialized metadata payload must be <= 4080 bytes.
 *
 * @param {String|Object} metadata
 * @api public
 */

Writer.prototype.queue = function (metadata) {
  if ('string' == typeof metadata) {
    // string title
    metadata = { StreamTitle: metadata };
  } else if (metadata && Object(metadata) === metadata) {
    // an object
  } else {
    throw new TypeError('don\'t know how to format metadata: ' + metadata);
  }
  if (!('StreamTitle' in metadata)) {
    throw new TypeError('a "StreamTitle" property is required for metadata');
  }
  var str = stringify(metadata);
  var len = Buffer.byteLength(str);
  if (len > MAX_LENGTH) {
    throw new Error('metadata must be <= 4080, got: ' + len);
  }
  var meta = Math.ceil(len / META_BLOCK_SIZE);
  var buf = new Buffer(meta * META_BLOCK_SIZE + 1);
  buf[0] = meta;
  var written = buf.write(str, 1);
  for (var i = written + 1; i < buf.length; i++) {
    // pad with NULL bytes
    buf[i] = 0;
  }

  this._queue.push(buf);
};

/**
 * Backwards-compat.
 *
 * @api private
 */

Writer.prototype.queueMetadata = Writer.prototype.queue;

/**
 * Writes the next "metabyte" to the output stream.
 *
 * @param {Function} write output callback function
 * @api private
 */

Writer.prototype._inject = function (write) {
  var buffer;
  if (0 === this._queue.length) {
    buffer = NO_METADATA;
  } else {
    buffer = this._queue.shift();
  }
  write(buffer);

  // passthrough "metaint" bytes before injecting the next metabyte
  this._passthrough(this.metaint, this._inject);
};
