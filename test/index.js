'use strict'

var should = require('chai').should()
var tbc = require('../')

describe('#versionGuard', function () {
  it('global._bsv should be defined', function () {
    should.equal(global._bsv, tbc.version)
  })

  it('throw an error if version is already defined', function () {
    (function () {
      tbc.versionGuard('version')
    }).should.not.throw('More than one instance of tbc')
  })
})
