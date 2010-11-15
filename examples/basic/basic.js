/**
 * This example script will attempt to connect to a random station
 * in the "radioStations.json" file, parse the metadata, and write
 * the clean, raw audio data to 'stdout'. Metadata and other debug
 * info gets printed to 'stderr'.
 *
 *   Usage:
 *     node examples/basic/basic.js > out.mp3
 */
var icecast = require("../../lib/icecast-stack");
var stations = require("../radioStations");

var stream = icecast.createReadStream(stations.random().url);

stream.on("response", function() {
  console.error("Radio Stream connected!");
  console.error(stream.headers);
});

stream.on("metadata", function(title) {
  console.error(title);
});

stream.pipe(process.stdout);
