
/**
 * Parse and stringify metadata Buffers to/from formatted Objects.
 */

exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');

/**
 * Low level transformation classes.
 */

exports.Reader = require('./lib/reader');
exports.Writer = require('./lib/writer');

/**
 * Icecast HTTP client interface. Aims to map directly 1-1 the "http" module's
 * client interface.
 */

exports.Client = require('./lib/client');
