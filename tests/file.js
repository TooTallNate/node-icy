var fs = require("fs");
const endOfHeader = "\r\n\r\n";

var file = __dirname + "/dumps/TheComedyChannel-1-16000.mp3";
var dash = file.lastIndexOf("-")+1;
var metaint = Number(file.substring(dash, file.indexOf(".", dash)));

var a = fs.readFileSync(file);
var bytesRead = 0;
var metaLength;

var firstByte = a.slice(0, 600).toString().indexOf(endOfHeader) + endOfHeader.length;
var headerBuf = a.slice(0, firstByte);
var header = headerBuf.toString('ascii');
a = a.slice(firstByte, a.length);
//console.error(headerBuf);
console.error(header);
//console.error(header.length == headerBuf.length);

while (a.length) {
  var b = a.slice(0, Math.min(metaint-1, a.length));
  process.stdout.write(b);
  if (b.length === a.length) break;
  
  a=a.slice(metaint, a.length);
  
  metaLength = a[0] * 16;
  console.error(metaLength);
  a=a.slice(1, a.length);
  if (metaLength) {
    //console.error("MetaLength: " + b+"*16= " + metaLength);
    var meta = a.slice(0, metaLength-1);
    console.error(meta.toString());
    a=a.slice(metaLength, a.length);
  } else {
    console.error("No MetaData!");
  }
}
