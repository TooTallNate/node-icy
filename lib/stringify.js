
/**
 * Module exports.
 */

module.exports = stringify;

/**
 * Takes an Object and converts it into an ICY metadata string.
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

function stringify (obj) {
  var s = [];
  Object.keys(obj).forEach(function (key) {
    s.push(key);
    s.push('=\'');
    s.push(obj[key]);
    s.push('\';');
  });
  return s.join('');
}
