const R = '\r'.charCodeAt(0);
const N = '\n'.charCodeAt(0);
const META_BLOCK_SIZE = 16;

var fs = require("fs");
var net = require("net");
var parse = require("url").parse;
var EventEmitter = require("events").EventEmitter;


/**
 * Create's an Internet Radio `ReadStream`. It emits "data" events similar to
 * the `fs` module's `ReadStream`, but never emits an "end" event (it's an infinite
 * radio stream). The Internet Radio `ReadStream` also emits a "metadata" event
 * which occurs after a metadata chunk has been recieved and parsed, for your
 * Node application to do something useful with.
 */
function ReadStream(url, retainMetadata) {

  this.url = new String(url);  
  var parsedUrl = parse(url);
  parsedUrl.__proto__ = this.url.__proto__;
  this.url.__proto__ = parsedUrl;
  
  // Not currently used:
  // TODO: If this is true, emit the metadata bytes as well
  this.retainMetadata = retainMetadata;

  this.connection = net.createConnection(this.url.port || (this.url.protocol == "https:" ? 443 : 80), this.url.hostname);
  this.connection.on("connect", this.onConnect.bind(this));
  this.connection.on("close", this.onClose.bind(this));
  this.connection.on("error", this.onError.bind(this));

  this.bindedOnMetaData = this.onMetaData.bind(this);
  this.bindedOnMetaLengthByte = this.onMetaLengthByte.bind(this);
  this.connection.on("data", (this.bindedOnData = this.onDataHeader.bind(this)));
  
  // The counter used to keep track of count of the audio/metadata bytes parsed.
  this.counter = 0;
}
exports.ReadStream = ReadStream;

// Make `ReadStream` inherit from `EventEmitter`
ReadStream.prototype = Object.create(EventEmitter.prototype, {
  constructor: {
    value: ReadStream,
    enumerable: false
  }
});

exports.appendBuffer = function(a, b) {
  var temp = new Buffer(a.length + b.length);
  a.copy(temp, 0, 0);
  b.copy(temp, a.length, 0);
  return temp;
}

// False immediately after instantiation, set to `true` right before the
// 'connect' event is fired.
ReadStream.prototype.connected = false;

// A boolean that is true by default, but turns false after an 'error' occured,
// or destroy() was called.
ReadStream.prototype.readable = true;

// Once connected, send a minimal HTTP request to connect to the radio stream.
ReadStream.prototype.onConnect = function() {
  this.connection.write(this.generateRequest());
}

// Called when the underlying "net" Stream emits a "data" event.
// Emits 'data' events passing 'chunk' until "metaint" bytes have
// been sent, then it sets 'onMetaLengthByte' for 'data' events.
ReadStream.prototype.onData = function(chunk) {
  if (this.metaint && this.counter == this.metaint) {
    this.counter = 0;
    this.connection.removeListener("data", this.bindedOnData);
    this.connection.addListener("data", this.bindedOnMetaLengthByte);
    this.connection.emit("data", chunk);
    
  } else if (this.metaint && this.counter + chunk.length >= this.metaint) {
    var audioEnd = this.metaint - this.counter;
    var audioChunk = chunk.slice(0, audioEnd);
    this.emit("data", audioChunk);
    this.counter += audioChunk.length;

    // There's still remaining data! It should be metadata!
    if (chunk.length != audioChunk.length) {
      var metadata = chunk.slice(audioEnd, chunk.length);
      this.connection.emit("data", metadata);      
    }
    
  } else if (chunk.length) {
    this.emit("data", chunk);
    this.counter += chunk.length;
  }
}

// Called when the underlying "net" Stream emits a "data" event.
// This is the initial HTTP response header parsing logic.
ReadStream.prototype.onDataHeader = function(chunk) {
  // Append 'chunk' into the 'response' variable
  if (this.headerBuffer) {
    this.headerBuffer = exports.appendBuffer(this.headerBuffer, chunk);
  } else {
    this.headerBuffer = chunk;
  }

  // If there's less than 8 bytes, it's still an unplausable response header,
  // don't even bother checking this time around, check the next 'data' event.
  if (this.headerBuffer.length < 8) return;
  
  // Check to see if the end of the header has been reached.
  // If so we need to determine what kind of response we got.
  for (var i=0, l=Math.min(this.headerBuffer.length-3, 8192); i<l; i++) {
    // Check for /r/n/r/n
    if (this.headerBuffer[i] == R && this.headerBuffer[i+1] == N && this.headerBuffer[i+2] == R && this.headerBuffer[i+3] == N) {
      // We found the end of the header!

      var leftover = this.headerBuffer.slice(i+4, this.headerBuffer.length);
      this.headerBuffer = this.headerBuffer.slice(0, i);

      this.parseHeaders();

      this.connection.removeListener("data", this.bindedOnData);
      this.connection.addListener("data", (this.bindedOnData = this.onData.bind(this)));
      
      // Emit the "connect" event. The headers are parsed now, so the user can
      // inspect them, and set up `ffmpeg` based on the 'content-type' perhaps?
      this.emit("connect", this);

      // If there are any bytes leftover after the header, then it's audio data that should
      // be handled by the new 'onData' callback, then passed back to the user.
      if (leftover.length > 0) {
        this.connection.emit("data", leftover);
      }
      return;
    }
  }
}

// Called when the underlying "net" Stream emits a "data" event.
// This 'data' parser is used when the radio stream is sending a 'metadata' event.
ReadStream.prototype.onMetaData = function(chunk) {

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
    this.connection.removeListener("data", this.bindedOnMetaData);
    this.connection.addListener("data", this.bindedOnData);
    if (metaEnd+1 < chunk.length) {
      var remainder = chunk.slice(metaEnd+1, chunk.length);
      //console.error(remainder.slice(0, Math.min(5, remainder.length)));
      this.connection.emit("data", remainder);
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
ReadStream.prototype.onMetaLengthByte = function(chunk) {
  
  var metaByte = chunk[0];
  //console.error("MetaByte: " + metaByte);
  
  this.metaLength = metaByte * META_BLOCK_SIZE;
  //console.error("MetaData Length: " + this.metaLength);

  this.counter = 0;
  this.connection.removeListener("data", this.bindedOnMetaLengthByte);
  this.connection.addListener("data", this.metaLength ? this.bindedOnMetaData : this.bindedOnData);
  if (chunk.length > 1) {
    var remains = chunk.slice(1, chunk.length);
    this.connection.emit("data", remains);
  }
}

// Generates the String HTTP request that gets sent to the remote server.
ReadStream.prototype.generateRequest = function() {
  return "GET " + (this.url.pathname ? this.url.pathname : "/") + (typeof this.url.search === 'string' ? this.url.search : "") + " HTTP/1.1\r\n"+
    "Host: " + this.url.host + "\r\n"+
    "Icy-MetaData:1\r\n"+
    "\r\n";
}

ReadStream.prototype.parseHeaders = function() {
  this.headerString = this.headerBuffer.toString();

  // If it's an ICY stream / raw HTTP stream (check content-type), make return the URL itself
  var firstLine = this.headerString.substring(0, this.headerString.indexOf("\r")).split(" ");
  
  // It's an ICY stream
  if (firstLine[0] == "ICY") {
    //console.error("Detected an ICY stream!");
  }
  
  this.headers = {};
  var headers = this.headerString.split("\r\n").slice(1);
  for (var i=0, l=headers.length; i<l; i++) {
    var header = headers[i].split(":");
    this.headers[header[0].trim()] = header[1].trim();
  }
  
  // Permenantly store the "metaint". It's used constantly throughout
  // the data parsing logic.
  Object.defineProperty(this, "metaint", {
    value: this.headers['icy-metaint'],
    enumerable: false,
    writable: false
  });
  
  // A flag to easily determine whether the 'connect' event has been fired or not.
  this.connected = true;
}

/**
 * Called when the underlying `net.Stream` connection emits a 'close' event.
 */
ReadStream.prototype.onClose = function() {
  this.emit("close");
}

/**
 * Called when the underlying `net.Stream` connection emits an 'error' event.
 */
ReadStream.prototype.onError = function(err) {
  this.connected = false;
  this.readable = false;
  this.emit("error", err);
}

/**
 * Pauses the incoming 'data' events.
 */
ReadStream.prototype.pause = function() {
  this.connection.pause();
}

/**
 * Resumes the incoming 'data' events after a pause().
 */
ReadStream.prototype.resume = function() {
  this.connection.resume();
}

/**
 * Closes the underlying `net.Stream`. Stream will not emit any more events.
 */
ReadStream.prototype.destroy = function() {
  this.connection.destroy();
  this.connected = false;
  this.readable = false;
}


/**
 * Returns a new ReadStream for the given Internet Radio URL.
 * First arg is the URL to the radio stream. Second arg is a
 * boolean indicating whether or not to include the metadata
 * chunks in the 'data' events. Defaults to 'false' (metadata,
 * is stripped, parsed, and formatted into the 'metadata' event).
 */
function createReadStream(url, retainMetadata) {
  return new ReadStream(url, retainMetadata);
}
exports.createReadStream = createReadStream;


/**
 * Accepts the String passed from the 'metadata' event, and parses it into
 * a JavaScript object.
 */
function parseMetadata(metadata) {
  var rtn = {}, pieces = metadata.split(";"), i=0, l=pieces.length;
  for (; i<l; i++) {
    var piece = stripNulls(pieces[i]);
    if (piece.length) {
      piece = piece.split("='");
      rtn[piece[0]] = piece[1].substring(0, piece[1].length-1);
    }
  }
  return rtn;
}
exports.parseMetadata = parseMetadata;

function stripNulls(str) {
  while(str.indexOf('\0') != -1) {
    str = str.replace('\0', '');
  }
  return str;
}
