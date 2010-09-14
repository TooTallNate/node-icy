/**
 * This example script will attempt to connect to a random station
 * in the "radioStations.json" file, parse the metadata, and write
 * the clean, raw audio data to 'stdout'. Metadata and other debug
 * info gets printed to 'stderr'.
 *
 *   Usage:
 *     node examples/basic/basic.js > out.mp3
 */
var radio = require("../../lib/radio-stream");
var stations = require("../radioStations");

var stream = radio.createReadStream(stations.random().url);

stream.on("connect", function() {
  console.error("Radio Stream connected!");
  console.error(stream.headers);
});

stream.on("data", function(chunk) {
  process.stdout.write(chunk);
});

stream.on("metadata", function(title) {
  console.error(title);
});
