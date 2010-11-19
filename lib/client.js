var net = require('net');
var parse = require('url').parse;
var HttpRequestStack = require('http-stack').HttpRequestStack;
var IcecastReadStack = require('./icecast-stack').IcecastReadStack;

/**
 * A full-blown Icecast/SHOUTcast compliant Client class. Conveniently takes
 * care of creating a low-level TCP connection, sending an HTTP request, and
 * parsing the 'metadata' events out of the resulting audio stream.
 */
function Client(url, headers, retainMetadata) {

  // parse the URL into a usable object
  var parsedUrl = parse(url);
  // ensure an HTTP based path and port
  parsedUrl.pathname = parsedUrl.pathname || '/';
  parsedUrl.port = parsedUrl.port || (parsedUrl.protocol == "https:" ? 443 : 80);

  // Create the low-level TCP connection to the remote server.
  var stream = net.createConnection(parsedUrl.port, parsedUrl.hostname);
  stream.allowHalfOpen = true;
  stream.remoteAddress = parsedUrl.hostname;
  stream.remotePort = parsedUrl.port;
  
  // Stack an 'HttpRequstStack' instance on it, and send an HTTP request
  // to the specified URL.
  stream = new HttpRequestStack(stream);
  headers.push('Host: ' + parsedUrl.host);
  headers.push('Icy-MetaData: 1');
  stream.get(parsedUrl.pathname, headers);
  stream.end();
  
  // Next stack "this" 'IcecastReadStack' instance on top of that, setting the
  // inital 'metaint' value to Infinity. Setting to Infinity is just a hack
  // that allows us to have the 'createClient' function return immediately,
  // instead of invoking a callback with the stream instance.
  IcecastReadStack.call(this, stream, Infinity, retainMetadata);
  
  // Keep a reference to the URL used to connect to the Icecast server.
  this.url = url;

  // When the 'response' event is fired (bubbled down from the
  // HttpRequestStack instance), check for the 'icy-metaint' response header.
  this.on('response', function(res) {
    this.headers = res.headers;
    if (res.headers['icy-metaint']) {
      this.metaint = Number(res.headers['icy-metaint']);
    }
  });
}
exports.Client = Client;
require('util').inherits(Client, IcecastReadStack);


/**
 * Convenience function to create a new Icecast 'Client' instance.
 */
function createClient(url, headers, retainMetadata) {
  if (headers === true || headers === false) {
    retainMetadata = headers;
    headers = [];
  } else if (!Array.isArray(headers)) {
    headers = [];
  }
  return new Client(url, headers, retainMetadata);
}
exports.createClient = createClient;

