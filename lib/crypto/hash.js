if (typeof window !== 'undefined') {
    module.exports = require('./hash.browser');
} else {
    module.exports = require('./hash.node');
}
