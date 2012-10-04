
var fs = require('fs');
var icecast = require('./');
var file = process.argv[2] || __dirname + '/test/dumps/4EverFloyd-1-8192.mp3';

var r = new icecast.Reader(8192);

// offset of 313 to skip the ICY-headers
fs.createReadStream(file, { start: 313 }).pipe(r);

r.on('metadata', function (metadata) {
  metadata = icecast.parse(metadata);
  console.error('METADATA EVENT:');
  console.error(metadata);
});

r.pipe(process.stdout);
