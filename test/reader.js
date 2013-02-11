
/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var icecast = require('../');
var assert = require('assert');

describe('Reader', function () {

  describe('4EverFloyd-1-8192.mp3', function () {
    var metaint = 8192;
    var fixture = path.resolve(__dirname, 'fixtures', '4EverFloyd-1-8192.mp3');

    it('should emit one "metadata" event', function (done) {
      var file = fs.createReadStream(fixture);
      var reader = new icecast.Reader(8192);
      var called = false;
      reader.on('metadata', function (metadata) {
        assert(!called);
        assert(Buffer.isBuffer(metadata));
        assert(metadata.length < 4096);
        called = true;
        done();
      });
      file.pipe(reader);
    });

  });

});
