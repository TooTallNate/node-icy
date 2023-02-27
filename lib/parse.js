
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

function parse(metadata) {
  if (Buffer.isBuffer(metadata)) {
    metadata = metadata.toString('utf8');
  }

  const startSubstring = "StreamTitle=";
  const startPosition = metadata.indexOf(startSubstring);
  const endSubstring = "';";
  const endPosition = metadata.toString().indexOf(endSubstring, startPosition);

  if (startPosition > -1 && endPosition > startPosition) {
    const titleString = metadata.substring(startPosition, endPosition);
    const title = titleString.substring(startSubstring.length + 1, titleString.length);
    return title;
  }

  return null;
}
