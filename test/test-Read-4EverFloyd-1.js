var fs = require('fs');
var http = require('http-stack');
var assert = require('assert');
var icecast = require('../');

exports['test 4EverFloyd-1.dump'] = function() {
  var stream = fs.createReadStream(__dirname + "/dumps/4EverFloyd-1.dump");
  var req = new http.HttpRequestStack(stream);
  req.on('response', onResponse);
  function onResponse(res) {
    assert.ok(res.headers);
    assert.equal(res.headers['icy-metaint'], 8192);

    var ice = new icecast.IcecastReadStack(req, res.headers['icy-metaint']);
    ice.on('metadata', onMetadata);
    ice.on('end', onEnd);
  }
  var metadataCount = 0;
  function onMetadata(title) {
    metadataCount++;
    var parsed = icecast.parseMetadata(title);
    assert.equal(parsed.StreamTitle, 'Shine on You Crazy Diamond, Pts. 1-5 - Shine on You Crazy Diamond, Pts. 1-5');
    assert.equal(parsed.StreamUrl, 'http:\/\/www.4EverFloyd.com');
  }
  function onEnd() {
    assert.equal(metadataCount, 1);
  }
}
