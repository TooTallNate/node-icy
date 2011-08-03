var inherits = require('util').inherits;
var StreamStack = require('stream-stack').StreamStack;

// On the meta-length byte, you must multiply/divide by META_BLOCK_SIZE
// to get the real metadata byte-length. We export is as a 'getter' only
// to ensure that it remains Read-Only.
const META_BLOCK_SIZE = 16;
exports.__defineGetter__('META_BLOCK_SIZE', function() { return META_BLOCK_SIZE; });

// Usually, there will be no metadata event to inject (on the WriteStack), so
// a single byte 0 is sent indicating 0 bytes of metadata.
const NO_METADATA_BYTE = new Buffer(1);
NO_METADATA_BYTE[0] = 0;

/**
 * A StreamStack meant for ReadStreams, or more specifically, a `net.Stream`
 * connected to and receiving audio data from an Icecast radio stream.
 * This stack removes the 'metadata' bytes and parses them into a "metadata"
 * event that your Node script can do something useful with.
 */
function IcecastReadStack(stream, metaint, retainMetadata) {

  StreamStack.call(this, stream, {
    data: function(chunk) {
      this._currentOnData(chunk);
    }
  });
  
  // The amount of audio bytes to read before a metadata byte gets sent.
  this.metaint = metaint;

  // Not currently used:
  // TODO: If this is true, emit the metadata bytes as well
  this.retainMetadata = retainMetadata || false;

  // The counter used to keep track of count of the audio/metadata bytes parsed.
  this.counter = 0;

  this._currentOnData = this.onData;
}
exports.IcecastReadStack = IcecastReadStack;
inherits(IcecastReadStack, StreamStack);

exports.appendBuffer = function(a, b) {
  var temp = new Buffer(a.length + b.length);
  a.copy(temp, 0, 0);
  b.copy(temp, a.length, 0);
  return temp;
}

// Called when the underlying Stream emits a "data" event.
// Emits 'data' events passing 'chunk' until "metaint" bytes have
// been sent, then it sets 'onMetaLengthByte' for 'data' events.
IcecastReadStack.prototype.onData = function(chunk) {
  if (this.metaint && this.counter == this.metaint) {
    this.counter = 0;
    this._currentOnData = this.onMetaLengthByte;
    this._currentOnData(chunk);
    
  } else if (this.metaint && this.counter + chunk.length >= this.metaint) {
    var audioEnd = this.metaint - this.counter;
    var audioChunk = chunk.slice(0, audioEnd);
    this.emit("data", audioChunk);
    this.counter += audioChunk.length;

    // There's still remaining data! It should be metadata!
    if (chunk.length != audioChunk.length) {
      var metadata = chunk.slice(audioEnd);
      this._currentOnData(metadata);
    }
    
  } else if (chunk.length) {
    this.emit("data", chunk);
    this.counter += chunk.length;
  }
}

// Called when the underlying Stream emits a "data" event.
// This 'data' parser is used when the radio stream is sending a 'metadata' event.
IcecastReadStack.prototype.onMetaData = function(chunk) {

  if (this.counter + chunk.length >= this.metaLength) {
    var metaEnd = this.metaLength - this.counter - 1;
    this.counter += metaEnd;
    var metaChunk = chunk.slice(0, metaEnd);
    
    if (this.metaBuffer) {
      this.metaBuffer = exports.appendBuffer(this.metaBuffer, metaChunk);
    } else {
      this.metaBuffer = metaChunk;
    }
    this.emit("metadata", this.metaBuffer.toString());
    //console.error("Meta Bytes Recieved: " + this.counter + ", " + this.metaBuffer.length);
    this.metaBuffer = null;
    this.metaLength = null;

    this.counter = 0;
    this._currentOnData = this.onData;
    if (metaEnd+1 < chunk.length) {
      var remainder = chunk.slice(metaEnd+1, chunk.length);
      //console.error(remainder.slice(0, Math.min(5, remainder.length)));
      this._currentOnData(remainder);
    }
  } else {
    if (this.metaBuffer) {
      this.metaBuffer = exports.appendBuffer(this.metaBuffer, chunk);
    } else {
      this.metaBuffer = chunk;
    }
    this.counter += chunk.length;
  }
}

// Called when the underlying "net" Stream emits a "data" event.
// This 'data' handler checks to see if there's any metadata in
// the upcoming bytes.
// 'chunk' is guaranteed to be at least 1 byte long.
IcecastReadStack.prototype.onMetaLengthByte = function(chunk) {
  var metaByte = chunk[0];
  //console.error("MetaByte: " + metaByte);
  this.metaLength = metaByte * META_BLOCK_SIZE;
  //console.error("MetaData Length: " + this.metaLength);
  this.counter = 0;
  this._currentOnData = this.metaLength > 0 ? this.onMetaData : this.onData;
  if (chunk.length > 1) {
    this._currentOnData(chunk.slice(1));
  }
}



/**
 * A StreamStack for WriteStreams (specifically `http.ServerResponse`,
 * `http.ClientRequest`, and `net.Stream`). It offers a 'queueMetadata(d)'
 * function that will inject the passed metadata into the audio stream
 * at the next given (metaint) interval.
 */
function IcecastWriteStack(stream, metaint) {
  StreamStack.call(this, stream);
  this.metaint = metaint;
  this.counter = 0;
  this._metadataQueue = [];
}
exports.IcecastWriteStack = IcecastWriteStack;
inherits(IcecastWriteStack, StreamStack);

/**
 * The 'queueMetadata' function queues a new 'metadata' event to be injected
 * upstream at the next metadata interval (metaint).
 */
var streamTitleRegExp = /StreamTitle='/;
IcecastWriteStack.prototype.queueMetadata = function(metadata) {
  //console.error(metadata);
  if (typeof(metadata) == 'string') {
    if (!streamTitleRegExp.test(metadata)) {
      // Ensure a 'StreamTitle' is somewhere in the string.
      metadata = "StreamTitle='" + metadata + "';";
    }
  } else if ('StreamTitle' in metadata) {
    // A regular object containing at least a StreamTitle property.
    // Append the 'StreamTitle' part first, to ensure it's part of the metadata.
    var str = "StreamTitle='" + metadata['StreamTitle'] + "';";
    delete metadata['StreamTitle'];
    // Then append the rest of the properies on the object (if any).
    for (var i in metadata) {
      str += i + "='" + metadata[i] + "';";
    }
    metadata = str;
  }
  //console.error(metadata);
  
  if (!streamTitleRegExp.test(metadata)) {
    throw new Error('"queueMetadata()" expects a String, or an object with a "StreamTitle" property.');
  }
  
  // Calculate the metalength byte, with a maximum of 255.
  var metaLength = Math.min(255, Math.ceil(metadata.length/META_BLOCK_SIZE));
  // Create a new Buffer that will contain the inital metalength byte, then
  // the metadata itself, and then will pad the rest of the Buffer with null bytes.
  var metaBuf = new Buffer((metaLength * META_BLOCK_SIZE)+1);
  metaBuf[0] = metaLength;
  var end = metaBuf.write(metadata, 1) + 1;
  if (end < metaBuf.length) {
    // Pad with null bytes
    for (var l=metaBuf.length; end<l; end++) {
      metaBuf[end] = 0;
    }
  }
  //console.error(metaBuf);
  //console.error(require('util').inspect(metaBuf.toString()));

  this._metadataQueue.push(metaBuf);
}

/**
 * The overwritten 'write()' function takes care of injecting the next item
 * in the metadataQueue if metaint bytes have been passed
 */
IcecastWriteStack.prototype.write = function(chunk, enc) {
  if (!Buffer.isBuffer(chunk)) {
    chunk = new Buffer(chunk, enc);
  }
  this._writeAudioChunk(chunk);
}

IcecastWriteStack.prototype._writeAudioChunk = function(chunk) {
  if (this.counter + chunk.length > this.metaint) {
    var first = chunk.slice(0, this.metaint - this.counter);
    this._writeAudioChunk(first);

    if (first.length < chunk.length) {
      this._writeAudioChunk(chunk.slice(first.length));
    }
  } else {
    this.stream.write(chunk);
    this.counter += chunk.length;
    //console.error('counter: ' + this.counter);

    if (this.counter == this.metaint) {
      this._injectNextMetadata();
    }
  }
}

/**
 * Checks if there's any entires in the 'metadataQueue' array, and if there are,
 * injects the next item in the queue into the audio write stream.
 */
IcecastWriteStack.prototype._injectNextMetadata = function() {
  //console.error('Injecting metadata!');
  //console.error('counter (metadata): ' + this.counter);
  var metaBuf = NO_METADATA_BYTE;
  if (this._metadataQueue.length > 0) {
    metaBuf = this._metadataQueue.shift();
  }
  this.stream.write(metaBuf);
  this.counter = 0;
}






/**
 * Returns a new ReadStream for the given Internet Radio URL.
 * First arg is the URL to the radio stream. Second arg is a
 * boolean indicating whether or not to include the metadata
 * chunks in the 'data' events. Defaults to 'false' (metadata,
 * is stripped, parsed, and formatted into the 'metadata' event).
 */
function createReadStream(url, headers, retainMetadata) {
  console.error("`require('icecast-stack').createReadStream()` has been "+
    "deprecated in favor of `require('icecast-stack/client').createClient()`.");
  return require('./client').createClient(url, headers, retainMetadata);
}
exports.createReadStream = createReadStream;







// Used to strip 'null' bytes from the metadata event
var nullExp = new RegExp('\0', 'g');
/**
 * Accepts the String passed from the 'metadata' event, and parses it into
 * a JavaScript object.
 */
function parseMetadata(metadata) {
  var rtn = {}, pieces = metadata.replace(nullExp, '').split(";");
  for (var i=0, l=pieces.length; i<l; i++) {
    var piece = pieces[i];
    if (piece.length) {
      piece = piece.split("='");
      rtn[piece[0]] = piece[1].substring(0, piece[1].length-1);
    }
  }
  return rtn;
}
exports.parseMetadata = parseMetadata;
