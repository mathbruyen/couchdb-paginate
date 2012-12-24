var devdb = require('../devdb');

var when = require('when');
var paginate = require('../index');
var assert = require("assert");

describe('Paginate', function () {
  var dbname;
  before(function (done) {
    devdb.devdb().then(function () {
      return devdb.load([], [{
        key: '_design/testdesign',
        doc: {
          views: {
            testview: {
              map: 'function (doc) { emit(doc.key, doc.value); }',
              reduce: 'function (keys, values) { return sum(values); }'
            }
          }
        }
      }]);
    }).then(function (name) {
      dbname = name;
      done();
    });
  });
  after(function (done) {
    devdb.stop().then(done);
  });
  it('should return empty list of documents if requested', function (done) {
    var req = {
      params: {}
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(0, req.previousIds.length);
      assert.equal(0, req.documents.length);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      allowEmpty: true
    })(req, res, next);
  });
  it('should refuse empty list by default', function (done) {
    var req = {
      params: {}
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done();
      } else {
        assert.fail();
      }
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview'
    })(req, res, next);
  });
});