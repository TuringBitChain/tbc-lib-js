var path = require('path')

module.exports = {
  entry: path.join(__dirname, '/index.js'),
  externals: {
    crypto: 'crypto'
  },
  output: {
    library: 'tbc',
    path: path.join(__dirname, '/'),
    filename: 'tbc.min.js'
  },
  mode: 'production'
}
