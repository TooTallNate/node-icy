
/**
 * Module dependencies.
 */

var assert = require('assert');
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
 */

var META_BLOCK_SIZE = 16;

/**
 * The maximum byte length of a metadata chunk.
 */

var MAX_LENGTH = META_BLOCK_SIZE * 255;

/**
 * Usually, the "metabyte" will just be 1 NUL byte, because there is no metadata
 * to be sent. Create that 1-byte buffer up-front.
 */

var NO_METADATA = new Buffer([0]);

/**
 * The `Writer` class is a duplex stream that accepts raw audio/video data and
 * passes it through untouched. It also has a `queue()` function that will
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
  this._queue = [];
}
inherits(Writer, Transform);

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
 */

Writer.prototype.queueMetadata = Writer.prototype.queue;

/**
 * The "transform" callback for the Transform base class.
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
  assert(0 === this.left);
  var buffer;
  if (0 === this._queue.length) {
    buffer = NO_METADATA;
  } else {
    buffer = this._queue.shift();
  }
  write(buffer);
  this.left = this.metaint;
};
