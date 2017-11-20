
/**
 * Module exports.
 */

module.exports = parse;

/**
 * Parses a Buffer (or String) containing ICY metadata into an Object.
 *
 * @param {Buffer|String} metadata The ICY metadata to parse.
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
    var piece = pieces[i].trim();
    if (piece.length > 0) {
      var delimiter = /\=(['"])/.exec(piece);
      var name = piece.substring(0, delimiter.index);
      var value = piece.substring(delimiter.index + 2, piece.length - 1);
      rtn[name] = value;
    }
  }
  return rtn;
}
