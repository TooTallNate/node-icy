
/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var icecast = require('../');
var assert = require('assert');

describe('Writer', function () {

  it('should work with a "metaint" of 1', function (done) {
    var w = new icecast.Writer(1);
    var output = [];
    w.on('data', function (b) {
      output.push(b);
    });
    w.on('end', function () {
      output = Buffer.concat(output);
      assert.equal('h\0e\0l\0l\0o\0w\u0003StreamTitle=\'this is a metadata title\';\0\0\0\0\0\0\0\0\0o\0r\0l\0d\0', output.toString());
      done();
    });
    w.write('hello');
    w.queue('this is a metadata title');
    w.end('world');
  });

});
