
var icecast = require('../');
var assert = require('assert');

describe('metadata parser', function () {

  it('should parse the metadata into an Object', function () {
    var input = new Buffer([ 83, 116, 114, 101, 97, 109, 84, 105, 116, 108, 101, 61, 39, 65, 110, 121, 32, 67, 111, 108, 111, 117, 114, 32, 89, 111, 117, 32, 76, 105, 107, 101, 32, 45, 32, 65, 110, 121, 32, 67, 111, 108, 111, 117, 114, 32, 89, 111, 117, 32, 76, 105, 107, 101, 39, 59, 83, 116, 114, 101, 97, 109, 85, 114, 108, 61, 39, 104, 116, 116, 112, 58, 47, 47, 119, 119, 119, 46, 52, 69, 118, 101, 114, 70, 108, 111, 121, 100, 46, 99, 111, 109, 39, 59, 0, 0 ]);
    var output = icecast.parse(input);
    assert.equal('object', typeof output);
    assert.equal('Any Colour You Like - Any Colour You Like', output.StreamTitle);
    assert.equal('http://www.4EverFloyd.com', output.StreamUrl);
    assert.deepEqual([ 'StreamTitle', 'StreamUrl' ], Object.keys(output));
  });

  it('should parse the metadata into an Object 2', function () {
    var input = new Buffer([ 83, 116, 114, 101, 97, 109, 84, 105, 116, 108, 101, 61, 39, 69, 99, 104, 111, 101, 115, 32, 32, 80, 97, 114, 116, 32, 73, 32, 45, 32, 69, 99, 104, 111, 101, 115, 32, 32, 80, 97, 114, 116, 32, 73, 39, 59, 83, 116, 114, 101, 97, 109, 85, 114, 108, 61, 39, 104, 116, 116, 112, 58, 47, 47, 119, 119, 119, 46, 52, 69, 118, 101, 114, 70, 108, 111, 121, 100, 46, 99, 111, 109, 39, 59, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]);
    var output = icecast.parse(input);
    assert.equal('object', typeof output);
    assert.equal('Echoes  Part I - Echoes  Part I', output.StreamTitle);
    assert.equal('http://www.4EverFloyd.com', output.StreamUrl);
    assert.deepEqual([ 'StreamTitle', 'StreamUrl' ], Object.keys(output));
  });

  it('should parse the metadata into an Object 3', function () {
    var input = 'StreamTitle=\'Grateful Dead - 1992-05-24  So Many Roads\';StreamUrl=\'http://www.dead.net?&artist=Grateful%20Dead&title=1992%2D05%2D24%20%20So%20Many%20Roads&album=1992%2D05%2D24%20%2D%20Shoreline%20Amphitheatre&duration=423288&songtype=S&overlay=no&buycd=http\';\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
    var output = icecast.parse(input);
    assert.equal('object', typeof output);
    assert.equal('Grateful Dead - 1992-05-24  So Many Roads', output.StreamTitle);
    assert.equal('http://www.dead.net?&artist=Grateful%20Dead&title=1992%2D05%2D24%20%20So%20Many%20Roads&album=1992%2D05%2D24%20%2D%20Shoreline%20Amphitheatre&duration=423288&songtype=S&overlay=no&buycd=http', output.StreamUrl);
    assert.deepEqual([ 'StreamTitle', 'StreamUrl' ], Object.keys(output));
  });

  it('should parse the metadata with utf8 symbols into an Object', function () {
    var input = new Buffer([ 83, 116, 114, 101, 97, 109, 84, 105, 116, 108, 101, 61, 39, 0xE2, 0x82, 0xAC, 39, 59, 83, 116, 114, 101, 97, 109, 85, 114, 108, 61, 39, 0xC2, 0xA2, 39, 59, 0, 0 ]);
    var euro = new Buffer([ 0xE2, 0x82, 0xAC ]);
    var cent = new Buffer([ 0xC2, 0xA2 ]);
    var output = icecast.parse(input);
    assert.equal('object', typeof output);
    assert.equal(euro.toString('utf8'), output.StreamTitle);
    assert.equal(cent.toString('utf8'), output.StreamUrl);
    assert.deepEqual([ 'StreamTitle', 'StreamUrl' ], Object.keys(output));
  });

});
