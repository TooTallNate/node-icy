var fs = require('fs');
var Stream = require('stream').Stream;

/**
 * Like a 'fs.ReadStream', but won't ever send an EOF. Instead, when an 'end'
 * event is received, a new underlying fs.ReadStream is reopened on 'path'.
 * Meant to be used with FIFOs: mkfifo(1) 
 */
function InfiniteFifo(path, options) {
  Stream.call(this);
  this.setup(path, options);
}
require('util').inherits(InfiniteFifo, Stream);
module.exports = InfiniteFifo;

InfiniteFifo.prototype.setup = function(path, options) {
  var self = this;
  self.rs = fs.createReadStream(path, options);
  self.rs.on('data', function(chunk) {
    self.emit('data', chunk);
  });
  self.rs.on('error', function(err) {
    console.error(err);
    self.rs.destory();
    self.setup(path, options);
  });
  self.rs.on('end', function() {
    console.error("got EOF on 'pcmFifo'; reopening stream");
    self.setup(path, options);
  });
}

InfiniteFifo.prototype.pause = function() {
  return this.rs.pause();
}

InfiniteFifo.prototype.resume = function() {
  return this.rs.resume();
}

Object.defineProperty(InfiniteFifo.prototype, 'readable', {
  get: function() {
    return this.rs.readable;
  }
});
