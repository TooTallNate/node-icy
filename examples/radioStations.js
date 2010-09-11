exports.stations = JSON.parse(require("fs").readFileSync(__filename+"on"));

exports.random = function() {
  var keys = Object.keys(exports.stations);
  var key = keys[Math.floor(Math.random()*keys.length)];
  return {
    name: key,
    url: exports.stations[key]
  }
}