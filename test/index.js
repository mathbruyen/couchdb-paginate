var devdb = require('../devdb');

var when = require('when');
var paginate = require('../index');
var assert = require("assert");

describe('Paginate', function () {
  before(function (done) {
    devdb.devdb().then(done);
  });
  after(function (done) {
    devdb.stop().then(done);
  });
  it('should return next 3 results', function (done) {
    devdb.load([
      { key: 1, value: 'Foo1' },
      { key: 2, value: 'Foo2' },
      { key: 3, value: 'Foo3' },
      { key: 4, value: 'Foo4' },
      { key: 5, value: 'Foo5' }
    ], [{
      key: '_design/testdesign',
      doc: {
        views: {
          testview: {
            map: 'function (doc) { emit(doc.key, doc.value); }'
          }
        }
      }
    }]).then(function (dbname) {
      var req = {
        params: {
          start: 2
        }
      };
      var res = {};
      var next = function (err) {
        if (err) {
          done(err);
        }
        assert.equal(3, req.documents.length);
        done();
      };
      paginate({
        couchURI: 'http://localhost:5984',
        database: dbname,
        design: 'testdesign',
        view: 'testview',
        pageSize: 3,
        uppermostKey: 1000,//TODO remove
        lowestKey: 0//TODO remove
      })(req, res, next);
    });
  });
});