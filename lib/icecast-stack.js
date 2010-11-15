var inherits = require('util').inherits;
var StreamStack = require('stream-stack').StreamStack;

// On the meta-length byte, you must multiply/divide by META_BLOCK_SIZE
// to get the real metadata byte-length.
var META_BLOCK_SIZE = 16;

/**
 * A StreamStack meant for ReadStreams, or more specifically, a `net.Stream`
 * connected to and receiving audio data from an Icecast radio stream.
 * This stack removes the 'metadata' bytes and parses them into a "metadata"
 * event that your Node script can do something useful with.
 */
function IcecastReadStack(stream, metaint, retainMetadata) {

  StreamStack.call(this, stream);
  
  // The amount of audio bytes to read before a metadata byte gets sent.
  this.metaint = metaint;

  // Not currently used:
  // TODO: If this is true, emit the metadata bytes as well
  this.retainMetadata = retainMetadata || false;

  // The counter used to keep track of count of the audio/metadata bytes parsed.
  this.counter = 0;

  this.bindedOnMetaData = this.onMetaData.bind(this);
  this.bindedOnMetaLengthByte = this.onMetaLengthByte.bind(this);
  this.stream.on("data", (this.bindedOnData = this.onData.bind(this)));
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
    this.stream.removeListener("data", this.bindedOnData);
    this.stream.addListener("data", this.bindedOnMetaLengthByte);
    this.stream.emit("data", chunk);
    
  } else if (this.metaint && this.counter + chunk.length >= this.metaint) {
    var audioEnd = this.metaint - this.counter;
    var audioChunk = chunk.slice(0, audioEnd);
    this.emit("data", audioChunk);
    this.counter += audioChunk.length;

    // There's still remaining data! It should be metadata!
    if (chunk.length != audioChunk.length) {
      var metadata = chunk.slice(audioEnd, chunk.length);
      this.stream.emit("data", metadata);      
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
    this.stream.removeListener("data", this.bindedOnMetaData);
    this.stream.addListener("data", this.bindedOnData);
    if (metaEnd+1 < chunk.length) {
      var remainder = chunk.slice(metaEnd+1, chunk.length);
      //console.error(remainder.slice(0, Math.min(5, remainder.length)));
      this.stream.emit("data", remainder);
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
  this.stream.removeListener("data", this.bindedOnMetaLengthByte);
  this.stream.addListener("data", this.metaLength > 0 ? this.bindedOnMetaData : this.bindedOnData);
  if (chunk.length > 1) {
    this.stream.emit("data", chunk.slice(1, chunk.length));
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
  this.metadataQueue = [];
  this.counter = 0;
}

/**
 * The overwritten 'write()' function takes care of injecting the next item
 * in the metadataQueue if metaint bytes have been passed
 */
IcecastWriteStack.prototype.write = function(chunk, enc) {
  
}
exports.IcecastWriteStack = IcecastWriteStack;
inherits(IcecastWriteStack, StreamStack);







/**
 * Returns a new ReadStream for the given Internet Radio URL.
 * First arg is the URL to the radio stream. Second arg is a
 * boolean indicating whether or not to include the metadata
 * chunks in the 'data' events. Defaults to 'false' (metadata,
 * is stripped, parsed, and formatted into the 'metadata' event).
 */
function createReadStream(url, retainMetadata) {
  // parse the URL into a usable object
  var parsedUrl = require('url').parse(url);
  // ensure an HTTP based path and port
  parsedUrl.pathname = parsedUrl.pathname || '/';
  parsedUrl.port = parsedUrl.port || (parsedUrl.protocol == "https:" ? 443 : 80);

  // Create the low-level TCP connection to the remote Icecast server.
  var stream = require('net').createConnection(parsedUrl.port, parsedUrl.hostname);
  
  // Stack an 'HttpRequstStack' instance on it, and send an HTTP request
  // to the specified URL.
  stream = new (require('http-stack').HttpRequestStack)(stream);
  stream.get(parsedUrl.pathname, [
    'Host: ' + parsedUrl.host,
    'Icy-MetaData:1' 
  ]);
  stream.end();
  
  // Next stack an 'IcecastReadStack' instance on top of that, setting the
  // inital 'metaint' value to Infinity. Setting to Infinity is just a hack
  // that allows us to have the 'createReadStream' function return directly,
  // instead of invoking a callback with the stream instance.
  stream = new IcecastReadStack(stream, Infinity, retainMetadata);

  // When the 'response' event is fired (bubbled down from the
  // HttpRequestStack instance), check for the 'icy-metaint' response header.
  stream.on('response', function(res) {
    stream.headers = res.headers;
    //console.error(res.headers);
    if (res.headers['icy-metaint']) {
      stream.metaint = res.headers['icy-metaint'];
    }
  });

  // Finally return the stacked stream. It looks like:
  //   -> net.Stream
  //   -> http-stack.HttpRequestStack
  //   -> icecast-stack.IcecastReadStack
  return stream;
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
