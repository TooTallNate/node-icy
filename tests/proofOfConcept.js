/**
 * This file opens up one of the streams in the "dumps" folder, and parses
 * it synchronously to demonstrate the 'metadata' concept in a straightforward
 * and readable way.
 *  
 * This script is just a verification that the protocol decriptions out on
 * the web are correct.
 **/

const fs = require("fs");
const endOfHeader = "\r\n\r\n";
const metaintHeader = "icy-metaint:";


// Read the contents of the stream into a Buffer.
var file = __dirname + "/dumps/"+ (process.argv[2] || "4EverFloyd-1-8192.mp3");
var a = fs.readFileSync(file);

// Find the position of the first byte of audio data (immediately after \r\n\r\n).
var firstByte = a.slice(0, 600).toString().indexOf(endOfHeader) + endOfHeader.length;
// Create a Buffer and String of the HTTP response headers.
var headerBuf = a.slice(0, firstByte);
var header = headerBuf.toString('ascii');
var metaintStart = header.indexOf(metaintHeader)+metaintHeader.length;
// The 'metaint' is the number of audio bytes in between metadata bytes
var metaint = Number(header.substring(metaintStart, header.indexOf("\r\n", metaintStart)));

// Shift those headers bytes off of the file contents so it only
// contains audio and metadata.
a = a.slice(firstByte, a.length);

while (true) {
  // Get 'metaint' bytes of Audio data into a Buffer.
  var b = a.slice(0, Math.min(metaint, a.length));
  console.error("Writing "+b.length+" bytes to stdout");
  // Print the Audio bytes to stdout.
  process.stdout.write(b);
  // If we're at the end of the stream, break;
  if (b.length === a.length) break;

  // Shift off the Audio bytes the were just printed to stdout.
  a=a.slice(metaint, a.length);

  // Get the MetaLength byte and multiply by 16.
  var metaLength = a[0] * 16;
  // Shift off the MetaLength byte.
  a=a.slice(1, a.length);
  // If the metaLength is something other than 0, then there's metadata!
  if (metaLength) {
    // Get 'metaLength'-1 bytes of data as a String of metadata
    var meta = a.slice(0, metaLength-1);
    // Shift off the metadata bytes.
    a=a.slice(metaLength, a.length);

    console.error(meta.toString());
  } else {

    console.error("No MetaData!");
  }
}
