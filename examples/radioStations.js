exports.stations = {
  '4 Ever Floyd': 'http://67.205.85.183:5500',
  '4 Ever Zeppelin': 'http://173.236.59.82:8330',
  'Feeling Floyd': 'http://streaming201.radionomy.com:80/FeelingFloyd?group=999',
  'KFRC': 'http://2133.live.streamtheworld.com:80/KFRCFMCMP3',
  '.977 The Comedy Channel': 'http://icecast3.977music.com/comedy',
  'LivePhish': 'http://radio.nugs.net:8002'
};

exports.random = function() {
  var keys = Object.keys(exports.stations);
  var key = keys[Math.floor(Math.random()*keys.length)];
  return {
    name: key,
    url: exports.stations[key]
  };
}

exports.fromName = function(name) {
  var regexp = new RegExp(name, 'i');
  for (var i in exports.stations) {
    if (regexp.test(i)) {
      return {
        name: i,
        url: exports.stations[i]
      };
    }
  }
}
