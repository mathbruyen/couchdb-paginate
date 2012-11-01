var devdb = require('../devdb');

var when = require('when');
var paginate = require('../index');
var assert = require("assert");

describe('Paginate with documents and page size of 3', function () {
  var dbname;
  before(function (done) {
    devdb.devdb().then(function () {
      return devdb.load([
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
              map: 'function (doc) { emit(doc.key, null); }'
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
  it('should return no prev link, 3 documents and 1 next link for default key', function (done) {
    var req = {
      params: {}
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(0, req.previousIds.length);
      assert.equal(3, req.documents.length);
      assert.equal('Foo1', req.documents[0].value);
      assert.equal(1, req.documents[0].key);
      assert.equal('Foo2', req.documents[1].value);
      assert.equal(2, req.documents[1].key);
      assert.equal('Foo3', req.documents[2].value);
      assert.equal(3, req.documents[2].key);
      assert.equal(1, req.nextIds.length);
      assert.equal(4, req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
  it('should return start page link, 3 documents and 1 next link for key 2', function (done) {
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
      assert.equal(1, req.previousIds.length);
      assert.equal(null, req.previousIds[0]);
      assert.equal(3, req.documents.length);
      assert.equal('Foo2', req.documents[0].value);
      assert.equal(2, req.documents[0].key);
      assert.equal('Foo3', req.documents[1].value);
      assert.equal(3, req.documents[1].key);
      assert.equal('Foo4', req.documents[2].value);
      assert.equal(4, req.documents[2].key);
      assert.equal(1, req.nextIds.length);
      assert.equal(5, req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
  it('should return start page link, 3 documents and no next link for key 3', function (done) {
    var req = {
      params: {
        start: 3
      }
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(1, req.previousIds.length);
      assert.equal(null, req.previousIds[0]);
      assert.equal(3, req.documents.length);
      assert.equal('Foo3', req.documents[0].value);
      assert.equal(3, req.documents[0].key);
      assert.equal('Foo4', req.documents[1].value);
      assert.equal(4, req.documents[1].key);
      assert.equal('Foo5', req.documents[2].value);
      assert.equal(5, req.documents[2].key);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
  it('should return start page link, 2 documents and no next link for key 4', function (done) {
    var req = {
      params: {
        start: 4
      }
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(1, req.previousIds.length);
      assert.equal(null, req.previousIds[0]);
      assert.equal(2, req.documents.length);
      assert.equal('Foo4', req.documents[0].value);
      assert.equal(4, req.documents[0].key);
      assert.equal('Foo5', req.documents[1].value);
      assert.equal(5, req.documents[1].key);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
  it('should return start page link, 1 document and no next link for key 5', function (done) {
    var req = {
      params: {
        start: 5
      }
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(1, req.previousIds.length);
      assert.equal(2, req.previousIds[0]);
      assert.equal(1, req.documents.length);
      assert.equal('Foo5', req.documents[0].value);
      assert.equal(5, req.documents[0].key);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
  it('should refuse to serve key 6', function (done) {
    var req = {
      params: {
        start: 6
      }
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
      view: 'testview',
      pageSize: 3,
      useDocuments: true
    })(req, res, next);
  });
});