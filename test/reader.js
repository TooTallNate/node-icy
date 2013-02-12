
/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var icecast = require('../');
var assert = require('assert');

describe('Reader', function () {

  it('should work with a "metaint" of 1', function (done) {
    var data = 'h\0e\0l\0l\u0001hello world\0\0\0\0\0o\0 \0w\0o\0r\0l\0d';
    var r = new icecast.Reader(1);
    var called = false;
    r.on('metadata', function (metadata) {
      assert(Buffer.isBuffer(metadata));
      assert.equal(16, metadata.length);
      assert.equal('hello world\0\0\0\0\0', metadata.toString('utf8'));
      called = true;
    });
    var output = [];
    r.on('data', function (b) {
      output.push(b);
    });
    r.on('end', function () {
      assert(called);
      assert.equal('hello world', Buffer.concat(output).toString());
      done();
    });
    r.end(data);
  });

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

  describe('4EverFloyd-2-8192.mp3', function () {
    var metaint = 8192;
    var fixture = path.resolve(__dirname, 'fixtures', '4EverFloyd-2-8192.mp3');

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
