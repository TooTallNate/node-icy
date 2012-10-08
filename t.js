
var url = process.argv[2] || 'http://radio.nugs.net:8002';
var icecast = require('./');

if (process.stdout.isTTY) {
  console.error('fatal: you must pipe this script to mpg123');
  process.exit(1);
}

icecast.get(url, function (res) {
  console.error(res);
  console.error(res.headers);
  res.on('metadata', onMetadata);
  res.pipe(process.stdout);
});

function onMetadata (metadata) {
  metadata = icecast.parse(metadata);
  console.error('METADATA EVENT:');
  console.error(metadata);
}
