var radio = require("./lib/radio-stream");

//var url = "http://66.197.229.245:9882";
// 4 Ever Floyd
var url = "http://67.205.85.183:7714";
// KFRC
//var url = "http://2133.live.streamtheworld.com:80/KFRCFMCMP3";
// .977 The Comedy Channel - MP3 / 48k
//var url = "http://icecast1.977music.com/comedy";
// .977 The Comedy Channel - MP3 / 80k
//var url = "http://icecast2.977music.com/comedy";
// .977 The Comedy Channel - AAC / 48k
//var url = "http://icecast3.977music.com/comedy";

var stream = radio.createReadStream(url);
  
// TEMPORARY
function testFile(filename, metaint) {
  stream.connection.destroy();
  stream.connection = require("fs").createReadStream(filename);
  stream.connection.on("data", stream.bindedOnData);
  stream.metaint = metaint;
}
//testFile(__dirname + "/tests/dumps/TheComedyChannel-1-16000.mp3", 16000);

stream.on("connect", function() {
  console.error("Radio Stream connected!");
  console.error(stream.headers);
});

var data=0;
stream.on("data", function(chunk) {
  //for (var i=0, l=chunk.length; i<l; i++) {
    //console.error((++data) + ": " + chunk[i]);
  //}
  process.stdout.write(chunk);
});

stream.on("metadata", function(title) {
  console.error(title);
});
