
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

function parse (metadata) {
  var rtn = {};
  if (Buffer.isBuffer(metadata)) {
    metadata = metadata.toString('utf8');
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
