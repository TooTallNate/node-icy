
/**
 * A very simple example of using the `icy.get()` function, which parallels
 * node's core `http.get()` function. The main difference is that this client
 * works as expected with servers that respond with the "ICY" http version.
 *
 * The `icy.Client` class also ensures that the "Icy-MetaData" header gets
 * sent, and the "res" object in the response callback also emits "metadata"
 * events.
 */

if (process.stdout.isTTY) {
  console.error('FATAL: you must pipe this script to `mpg123`' +
      ' (or somewhere else interesting)');
  process.exit(1);
}

/**
 * Module dependencies.
 */

var icy = require('../');

/**
 * The ICY stream URL to connect to.
 */

var url = process.argv[2] || 'http://firewall.pulsradio.com';

/**
 * Send a GET http request to the specified ICY URL.
 */

icy.get(url, function (res) {

  // log out the HTTP headers
  console.error(res.headers);

  // call `onMetadata` when a "metadata" event happens
  res.on('metadata', onMetadata);

  // pipe the clean data (metadata is removed) to `stdout`
  res.pipe(process.stdout);
});

/**
 * Invoked for every "metadata" event from the `res` stream.
 */

function onMetadata (metadata) {
  metadata = icy.parse(metadata);
  console.error('METADATA EVENT:');
  console.error(metadata);
}
