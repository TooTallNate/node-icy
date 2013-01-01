
/**
 * Module exports.
 */

module.exports = parse;

var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');

/**
 * Parses a Buffer containing Icecast metadata into an Object.
 *
 * @param {Buffer} metadata The Icecast metadata to parse.
 * @return {Object} The parsed metadata object.
 * @api public
 */

function parse (metadata) {
  var rtn = {};
  var pieces = decoder.write(metadata).replace(/\0*$/, '').split(';');
  for (var i = 0; i < pieces.length; i++) {
    var piece = pieces[i];
    if (piece.length > 0) {
      piece = piece.split(/\=['"]/);
      rtn[piece[0]] = String(piece[1]).replace(/['"]$/, '');
    }
  }
  return rtn;
}
