/**
 * This example script uses the high-level Icecast 'Client' class to connect to
 * a random station in the "radioStations.js" file, parse the metadata, and
 * write the clean, raw audio data to 'stdout'. Metadata and other debug
 * info gets printed to 'stderr' in pretty colors :)
 *
 *   Usage:
 *     node examples/basic/basic.js | mpg123 -
 */
require('colors');
var icecast = require('../..')
  , stations = require('../radioStations')


// Create a high-level Icecast Client instance.
var url = process.argv[2] || stations.random().url
  , stream = require('../../client').createClient(url)
console.error(('Sending HTTP Request for: '.bold + url).cyan);


// 'connect' is fired when the TCP stream connection is established.
stream.on('connect', function() {
  var topStream = stream.topStream;
  console.error(('Connected to: '.bold + topStream.remoteAddress + ':' + topStream.remotePort).magenta);
});


// 'response' is fired after the HTTP response headers have been received.
stream.on('response', function() {
  console.error('HTTP Response Headers Received:'.green.bold);
  stream.headers.forEach(function(header) {
    console.error('  ' + header.key.blue.bold + ':'.green, header.value.blue);
  });
});


// 'metadata' is fired every time the song changes on the audio stream.
// Use the 'parseMetadata' function to parse the metadata String into an Object.
stream.on('metadata', function(title) {
  var metadata = '';
  // Parse the 'title' String into an Object.
  var parsed = icecast.parseMetadata(title);
  for (var i in parsed) {
    metadata += (i+': ').yellow.bold + (parsed[i]+' ').white;
  }
  console.error(metadata);
});


// As long as the 'stdout' is being redirected to something, pipe the audio to stdout.
if (!process.stdout.isTTY) {
  stream.pipe(process.stdout);
} else {
  console.error("Use your shell to redirect the audio data from 'stdout' someplace useful:".red.bold);
  console.error("  Ex:  ".red.bold + (process.argv.join(' ') + ' | mpg123 -').red);
}

