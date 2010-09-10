var fs = require("fs");
var metaint = 16000;

a = fs.readFileSync("KFRC-16000.mp3");
var bytesRead = 0;
var metaLength;
for (var i=0, l=a.length; i<l; i++) {
  var b = a[i];
  bytesRead++;
  if (bytesRead == (metaint+1)) {
    metaLength = b*16;
    if (metaLength) {
      console.error("MetaLength: " + b+"*16= " + metaLength);
      var meta = a.slice(i+1, i+metaLength);
      console.error(meta.toString());
      i+=metaLength;
    } else {
      console.error("No MetaData!");
    }
    bytesRead = 0;
  } else {
    //console.error((bytesRead-1) +": " +b);
  }
  //console.error((bytesRead-1) +": " +b);
}