var devdb = require('../devdb').devdb();
var when = require('when');
var nano = require('nano')('http://localhost:5984');
var paginate = require('../index');
var assert = require("assert");

var dbId = 1;

function load(documents, nameds) {
  var dbname = 'test' + (dbId++);
  return devdb.then(function () {
    var deferred = when.defer();
    nano.db.create(dbname, function () {
      deferred.resolve(nano.use(dbname));
    });
    return deferred.promise;
  }).then(function (db) {
    var promises = [];
    documents.forEach(function (doc) {
      var deferred = when.defer();
      db.insert(doc, function (err, body) {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      });
      promises.push(deferred.promise);
    });
    nameds.forEach(function (named) {
      var deferred = when.defer();
      db.insert(named.doc, named.key, function (err, body) {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      });
      promises.push(deferred.promise);
    });
    return when.all(promises);
  }).then(function () {
    return dbname;
  });
}

describe('Paginate', function () {
  it('should return next 3 results', function (done) {
    load([
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