var radio = require("./radio");

//var url = "http://66.197.229.245:9882";
// 4 Ever Floyd
var url = "http://67.205.85.183:7714";
// KFRC
//var url = "http://2133.live.streamtheworld.com:80/KFRCFMCMP3";
var stream = radio.createReadStream(url);
  
// TEMPORARY
//stream.connection = require("fs").createReadStream("4everFloyd.mp3");
//stream.metaint = 8192;
//stream.connection = require("fs").createReadStream("KFRC-16000.mp3");
//stream.metaint = 16000;
//stream.bindedOnData = stream.onData.bind(stream);
//stream.connection.addListener("data", stream.bindedOnData);


stream.on("connect", function() {
  //console.error("Radio Stream connected!");
  //console.error(stream.headers);
});

var data=0;
stream.on("data", function(chunk) {
  for (var i=0, l=chunk.length; i<l; i++) {
    //console.error((++data) + ": " + chunk[i]);
  }
  process.stdout.write(chunk);
});

stream.on("metadata", function(title) {
  console.error(title);
});
