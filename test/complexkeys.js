var devdb = require('../devdb');

var when = require('when');
var paginate = require('../index');
var assert = require("assert");

describe('Paginate with complex keys and page size of 3', function () {
  var dbname;
  before(function (done) {
    devdb.devdb().then(function () {
      return devdb.load([
        { group: 1, timestamp: 123, value: 'Bar1' },
        { group: 2, timestamp: 124, value: 'Foo1' },
        { group: 2, timestamp: 125, value: 'Foo2' },
        { group: 2, timestamp: 126, value: 'Foo3' },
        { group: 2, timestamp: 127, value: 'Foo4' },
        { group: 2, timestamp: 128, value: 'Foo5' },
        { group: 3, timestamp: 129, value: 'Baz1' }
      ], [{
        key: '_design/testdesign',
        doc: {
          views: {
            testview: {
              map: 'function (doc) { emit([doc.group, doc.timestamp], null); }'
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
      params: {
        group: 2
      }
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(0, req.previousIds.length);
      assert.equal(3, req.documents.length);
      assert.equal('Foo1', req.documents[0].value);
      assert.equal('Foo2', req.documents[1].value);
      assert.equal('Foo3', req.documents[2].value);
      assert.equal(1, req.nextIds.length);
      assert.deepEqual([2, 127], req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
  it('should return start page link, 3 documents and 1 next link for key 2', function (done) {
    var req = {
      params: {
        group: 2,
        start: 125
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
      assert.equal('Foo3', req.documents[1].value);
      assert.equal('Foo4', req.documents[2].value);
      assert.equal(1, req.nextIds.length);
      assert.deepEqual([2, 128], req.nextIds[0]);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
  it('should return start page link, 3 documents and no next link for key 3', function (done) {
    var req = {
      params: {
        group: 2,
        start: 126
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
      assert.equal('Foo4', req.documents[1].value);
      assert.equal('Foo5', req.documents[2].value);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
  it('should return start page link, 2 documents and no next link for key 4', function (done) {
    var req = {
      params: {
        group: 2,
        start: 127
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
      assert.equal('Foo5', req.documents[1].value);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
  it('should return start page link, 1 document and no next link for key 5', function (done) {
    var req = {
      params: {
        group: 2,
        start: 128
      }
    };
    var res = {};
    var next = function (err) {
      if (err) {
        done(err);
      }
      assert.equal(1, req.previousIds.length);
      assert.deepEqual([2, 125], req.previousIds[0]);
      assert.equal(1, req.documents.length);
      assert.equal('Foo5', req.documents[0].value);
      assert.equal(0, req.nextIds.length);
      done();
    };
    paginate({
      couchURI: 'http://localhost:5984',
      database: dbname,
      design: 'testdesign',
      view: 'testview',
      pageSize: 3,
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
  it('should refuse to serve key 6', function (done) {
    var req = {
      params: {
        group: 2,
        start: 129
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
      useDocuments: true,
      getBounds: function (req) {
        return [
          [req.params.group, 0],
          [req.params.group, req.params.start || 0],
          [req.params.group, 9007199254740992]
        ];
      }
    })(req, res, next);
  });
});