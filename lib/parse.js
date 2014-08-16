/**
 * Module dependencies.
 */

var Iconv = require('iconv').Iconv;

/**
 * Module exports.
 */

module.exports = parse;

/**
 * Parses a Buffer (or String) containing Icecast metadata into an Object.
 *
 * @param {Buffer|String} metadata The Icecast metadata to parse.
 * @return {Object} The parsed metadata object.
 * @api public
 */

function parse (metadata, encoding) {
  var rtn = {};
  if (Buffer.isBuffer(metadata)) {
    if (encoding) metadata = (new Iconv(encoding, 'UTF-8')).convert(metadata);
    metadata = metadata.toString();
  }
  var pieces = metadata.replace(/\0*$/, '').split(';');
  for (var i = 0; i < pieces.length; i++) {
    var piece = pieces[i];
    if (piece.length > 0) {
      piece = piece.split(/\=['"]/);
      rtn[piece[0]] = String(piece[1]).replace(/['"]$/, '');
    }
  }
  return rtn;
}
