var devdb = require('../devdb');

var when = require('when');
var paginate = require('../index');
var assert = require("assert");

describe('Paginate with reduced value and page size of 3', function () {
  var dbname;
  before(function (done) {
    devdb.devdb().then(function () {
      return devdb.load([
        { key: 1, value: 10 },
        { key: 2, value: 10 },
        { key: 2, value: 15 },
        { key: 3, value: 10 },
        { key: 3, value: 15 },
        { key: 3, value: 20 },
        { key: 4, value: 10 },
        { key: 4, value: 15 },
        { key: 4, value: 20 },
        { key: 4, value: 25 },
        { key: 5, value: 10 },
        { key: 5, value: 15 },
        { key: 5, value: 20 },
        { key: 5, value: 25 },
        { key: 5, value: 30 }
      ], [{
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
      assert.equal(10, req.documents[0]);
      assert.equal(25, req.documents[1]);
      assert.equal(45, req.documents[2]);
      assert.equal(1, req.nextIds.length);
      assert.equal(4, req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3
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
      assert.equal(25, req.documents[0]);
      assert.equal(45, req.documents[1]);
      assert.equal(70, req.documents[2]);
      assert.equal(1, req.nextIds.length);
      assert.equal(5, req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3
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
      assert.equal(45, req.documents[0]);
      assert.equal(70, req.documents[1]);
      assert.equal(100, req.documents[2]);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3
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
      assert.equal(70, req.documents[0]);
      assert.equal(100, req.documents[1]);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3
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
      assert.equal(100, req.documents[0]);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3
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
      pageSize: 3
    })(req, res, next);
  });
});