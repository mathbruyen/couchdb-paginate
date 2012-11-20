// (c) Mathieu Bruyen - http://mais-h.eu/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

var nano = require('nano');
var when = require('when');
var apply = require('when/apply');

// # CouchDB pagination
//
// [Connect](http://www.senchalabs.org/connect/) middleware for paginated [CouchDB](https://couchdb.apache.org/) views.
// Inspired from [CouchDB guide](http://guide.couchdb.org/draft/recipes.html#pagination), but left the dealbreaker part
// out (expects keys to be unique, either emitted by only one document or reduced).
//
// ## Examples
//
// ### Reduced values
//
// View with both a `map` and a reduce function:
//
//     var paginate = require('couchdb-paginate');
//     app.get('/list/:start', paginate({
//       couchURI: 'http://localhost:5984',
//       database: 'dbname',
//       design: 'mydesign',
//       view: 'myview'
//     }), function (req, res, next) { /* display */ });
//
// ### Indexed documents
//
// View with only a `map` function like `function (doc) { emit(doc.key, null); }`:
//
//     var paginate = require('couchdb-paginate');
//     app.get('/list/:start', paginate({
//       couchURI: 'http://localhost:5984',
//       database: 'dbname',
//       design: 'mydesign',
//       view: 'myview',
//       useDocuments: true
//     }), function (req, res, next) { /* display */ });
//
// ### API access (JSON)
//
// View with only a `map` function like `function (doc) { emit(doc.key, null); }`:
//
//     var paginate = require('couchdb-paginate');
//     app.get('/api/list/:start', paginate({
//       couchURI: 'http://localhost:5984',
//       database: 'dbname',
//       design: 'mydesign',
//       view: 'myview',
//       asJson: true
//     }));
//
// ### View displaying
//
// View with only a `map` function like `function (doc) { emit(doc.key, null); }`:
//
//     var paginate = require('couchdb-paginate');
//     app.get('/list/:start', paginate({
//       couchURI: 'http://localhost:5984',
//       database: 'dbname',
//       design: 'mydesign',
//       view: 'myview',
//       renderView: 'myview.jade'
//     }));
//
// ### Complex keys
//
// Blog posts example: comments attached to posts, organized by timestamp.
//
// Document example:
//
//     { postId: "abcdef", timestamp: 1234, author: "Foo", comment: "Bar" }
//
// Map function (no reduce function):
//
//     function (doc) { emit([doc.postId, doc.timestamp], null); }
//
// Pagination of comments for a given post exposed as an JSON API:
//
//     var paginate = require('couchdb-paginate');
//     app.get('/comments/:post/:startTimestamp', paginate({
//       couchURI: 'http://localhost:5984',
//       database: 'dbname',
//       design: 'blogposts',
//       view: 'comments_by_post',
//       useDocuments: true
//       asJson: true,
//       getBounds: function (req) {
//         return [
//           [req.params.post, 0],
//           [req.params.post, req.params.startTimestamp],
//           [req.params.post, 9007199254740992]
//         ];
//       }
//     }));
module.exports = function (config) {
  // ## Configuration options
  //
  // ### Connection to the database
  //
  // * `couchURI`: URI of the CouchDB store
  // * `database`: CouchDB database name
  // * `design`: design name in couchdb
  // * `view`: view name in design
  if (typeof config.couchURI != 'string') {
    throw new TypeError('"couchURI" is not a string');
  }
  if (typeof config.database != 'string') {
    throw new TypeError('"database" is not a string');
  }
  var db = nano(config.couchURI).use(config.database);
  var design = config.design;
  if (typeof design != 'string') {
    throw new TypeError('"design" is not a string');
  }
  var view = config.view;
  if (typeof view != 'string') {
    throw new TypeError('"view" is not a string');
  }
  // ### Bounds and navigation
  //
  // * `getStartKey` (default: fetch from query parameter called `start`): how to get requested start key from the request
  // * `getBounds` (default: no limits and start key from `getStartKey`): how to get navigation bounds from the request (if set then `getStartKey` will be ignored)
  //
  // Get bounds is expected to return an array (or a promise that will resolve an array) with three elements:
  // * the lowest key to display
  // * the current page start key
  // * the highest key to display
  // By default it uses no limits and take start key from request parameter `start`. Can be used to have more complex
  // keys.
  var getBounds;
  if (typeof config.getBounds == 'function') {
    getBounds = config.getBounds;
  } else if (typeof config.getBounds == 'undefined') {
    if (typeof config.getStartKey == 'function') {
      var getStartKey = config.getStartKey;
      getBounds = function (req) { return [undefined, getStartKey(req), undefined]; };
    } else if (typeof config.getBounds == 'undefined') {
      getBounds = function (req) { return [undefined, req.params.start, undefined]; };
    } else {
      throw new TypeError('"getStartKey" is not a function');
    }
  } else {
    throw new TypeError('"getBounds" is not a function');
  }
  // ### Content to display
  //
  // * `pageSize` (default: `20`): number of items per page
  // * `nextNumber` (default: `1`): number of next links to compute
  // * `prevNumber` (default: the value of `nextNumber`): number of previous links to compute
  // * `useDocuments` (default: `false`): use documents instead of reduced values
  // * `reduce` (default: opposite of `useDocuments`): informs that there is a reduce function in the view
  //
  // By default it assumes that the view is a complete one with a reduce function and uses the reduced value as
  // content. By setting `useDocuments` to `false`, it works on indexing views with no emitted value
  // (`emit(doc.myKey, null)`) and in that case it assumes there is no reduce function. By explicitely setting
  // `reduce` to `false`, it allows to work with views that emit a value but do not use a reduce function.
  var pageSize = config.pageSize || 20;
  if (typeof pageSize != 'number' || isNaN(pageSize) || Math.floor(pageSize) !== pageSize || pageSize <= 0) {
    throw new TypeError('"pageSize" is not a strictly positive integer');
  }
  var nextNumber = config.nextNumber || 1;
  if (typeof nextNumber != 'number' || isNaN(nextNumber) || Math.floor(nextNumber) !== nextNumber || nextNumber < 0) {
    throw new TypeError('"nextNumber" is not a positive integer');
  }
  var prevNumber = config.prevNumber || nextNumber;
  if (typeof prevNumber != 'number' || isNaN(prevNumber) || Math.floor(prevNumber) !== prevNumber || prevNumber < 0) {
    throw new TypeError('"prevNumber" is not a positive integer');
  }
  var useDocuments = config.useDocuments || false;
  if (typeof useDocuments != 'boolean') {
    throw new TypeError('"useDocuments" is not a boolean');
  }
  var reduce;
  if (typeof config.reduce == 'undefined') {
    reduce = !useDocuments;
  } else if (typeof config.reduce == 'boolean') {
    reduce = config.reduce;
  }
  else {
    throw new TypeError('"reduce" is not a boolean');
  }
  // ### Way to display content
  //
  // * `asJson` (default: `false`): sends the content as JSON (if set to `true` then `renderView` will be ignored)
  // * `renderView`: view to render with data (ignored if `asJson` is set to `true`)
  // * `documentsExportKey` (default: `documents`): key in the content that holds the array of elements to display
  // * `nextExportKey` (default: `nextIds`): key in the content that holds the array of next start identifiers
  // * `previousExportKey` (default: `previousIds`): key in the content that holds the array of previous start identifiers
  //
  // By default content is simply added to the request object at specified keys, and next middleware can handle it.
  // However there are two possible shortcuts: directly send the JSON content, or render a view with content.
  var asJson = config.asJson || false;
  if (typeof asJson != 'boolean') {
    throw new TypeError('"asJson" is not a boolean');
  }
  var renderView = config.renderView || null;
  if (renderView !== null && typeof renderView != 'string') {
    throw new TypeError('"renderView" is not a string');
  }
  var documentsExportKey = config.documentsExportKey || 'documents';
  if (typeof documentsExportKey != 'string') {
    throw new TypeError('"documentsExportKey" is not a string');
  }
  var nextExportKey = config.nextExportKey || 'nextIds';
  if (typeof nextExportKey != 'string') {
    throw new TypeError('"nextExportKey" is not a string');
  }
  var previousExportKey = config.previousExportKey || 'previousIds';
  if (typeof previousExportKey != 'string') {
    throw new TypeError('"previousExportKey" is not a string');
  }
  // ## Helper to query the database
  function query(startkey, endkey, limit, include_docs, descending) {
    // General data, allowing not to specify `include_docs` or `descending`.
    var obj = {
      limit: limit
    };
    if (reduce) {
      obj.group = true;
    }
    if (include_docs) {
      obj.include_docs = true;
    }
    if (descending) {
      obj.descending = true;
    }
    // In case the start key is undefined (start page with no lowest key), do not include it in the request.
    if (startkey !== undefined) {
      obj.startkey = startkey;
    }
    // In case the end key is undefined (no lowest key or no uppermost key), do not include it in the request.
    if (endkey !== undefined) {
      obj.endkey = endkey;
    }
    // Do the query and return a promise that holds the body.
    var deferred = when.defer();
    db.view(design, view, obj, function (err, body) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(body);
      }
    });
    return deferred.promise;
  }
  var fetchPrev;
  // ## Prepare the method used to fetch current and next pages.
  var fetchCurrentAndNext;
  // When fetching documents, use different requests to get next pages start keys and documents to limit response
  // size. Otherzise the content would be fetched anyway so get documents and next pages start keys in one request.
  if (useDocuments) {
    fetchCurrentAndNext = function (startKey, uppermostKey) {
      var documentsDef = when.defer();
      var nextDef = when.defer();
      query(startKey, uppermostKey, pageSize, true).then(function (body) {
        // Prevent empty pages.
        if (body.rows.length === 0) {
          documentsDef.reject('No document found');
          nextDef.reject('No document found');
        } else {
          // Select documents.
          documentsDef.resolve(body.rows.map(function (item) { return item.doc; }));
          // No need to compute next pages start keys if there are not enought result to even fully populate this page.
          if (body.rows.length === pageSize) {
            // `nextNumber - 1` to include only the first document of the last path and `+ 2` because the last
            // document of this page is also included.
            query(body.rows[body.rows.length - 1].key, uppermostKey, (pageSize * (nextNumber - 1)) + 2).then(function (body) {
              var pages = [];
              for (var i = 1; i < body.rows.length; i += pageSize) {
                pages.push(body.rows[i].key);
              }
              nextDef.resolve(pages);
            }, function (err) {
              nextDef.reject(err);
            });
          } else {
            nextDef.resolve([]);
          }
        }
      }, function (err) {
        documentsDef.reject(err);
        nextDef.reject(err);
      });
      return [documentsDef.promise, nextDef.promise];
    };
  // If no next pages are requested no need to query extra documents at all.
  } else if (nextNumber === 0) {
    fetchCurrentAndNext = function (startKey, uppermostKey) {
      var documentsDef = when.defer();
      query(startKey, uppermostKey, pageSize).then(function (body) {
        // Prevent empty pages.
        if (body.rows.length === 0) {
          documentsDef.reject('No document found');
        } else {
          // Select reduced values.
          documentsDef.resolve(body.rows.map(function (item) { return item.value; }));
        }
      }, function (err) {
        documentsDef.reject(err);
      });
      return [documentsDef.promise, []];
    };
  } else {
    fetchCurrentAndNext = function (startKey, uppermostKey) {
      var documentsDef = when.defer();
      var nextDef = when.defer();
      // Make a single big query to get both current page and next pages start keys.
      query(startKey, uppermostKey, (pageSize * nextNumber) + 1).then(function (body) {
        // Prevent empty pages.
        if (body.rows.length === 0) {
          documentsDef.reject('No document found');
          nextDef.reject('No document found');
        } else {
          var documents = [];
          var pages = [];
          var i;
          // Select values only for the page range.
          for (i = 0; i < pageSize && i < body.rows.length; i++) {
            documents.push(body.rows[i].value);
          }
          for (i = pageSize; i < body.rows.length; i += pageSize) {
            pages.push(body.rows[i].key);
          }
          documentsDef.resolve(documents);
          nextDef.resolve(pages);
        }
      }, function(err) {
        documentsDef.reject(err);
        nextDef.reject(err);
      });
      return [documentsDef.promise, nextDef.promise];
    };
  }
  // ## Prepare the method used to fetch previous pages.
  //
  // No need to query for previous pages if no page requested.
  if (prevNumber === 0) {
    fetchPrev = function () {
      return [];
    };
  } else {
    fetchPrev = function (startKey, lowestKey) {
      // No need to query for previous pages if on the start page.
      if (startKey === lowestKey) {
        return [];
      // In general case fetch the number of elements in previous pages plus two (one because the start document is
      // included in the results and one to detect if the last fetched page is actually the first one) and record the
      // keys of start keys, with additional start page detection.
      } else {
        var deferred = when.defer();
        query(startKey, lowestKey, (prevNumber * pageSize) + 2, false, true).then(function (body) {
          var pages = [];
          for (var i = pageSize; i < body.rows.length && pages.length < prevNumber; i += pageSize) {
            pages.push(body.rows[i].key);
          }
          // If the response contains less items than expected then start page is included.
          if (body.rows.length > 1 && body.rows.length !== (prevNumber * pageSize) + 2) {
            // Start page is actually the last one recorded (do not test for equality with lowestKey as the later may
            // not exist at all).
            if (body.rows[body.rows.length - 1].key === pages[pages.length - 1]) {
              pages[pages.length - 1] = null;
            // Start page is an additional one if there is more than this page first element in the response.
            } else {
              pages.push(null);
            }
          }
          deferred.resolve(pages);
        }, function (err) {
          deferred.reject(err);
        });
        return deferred.promise;
      }
    };
  }
  // ## Actual middleware
  return function (req, res, next) {
    when(getBounds(req)).then(apply(function (lowestKey, startKey, uppermostKey) {
      var nextDef = when.defer();
      var documentsDef = when.defer();
      // If start key is not provided, then use the lowermost one to get start page.
      if (startKey === undefined) {
        startKey = lowestKey;
      }
      var tmp = fetchCurrentAndNext(startKey, uppermostKey);
      return when.all([fetchPrev(startKey, lowestKey), tmp[0], tmp[1]]).then(function (resolved) {
        // Build the output.
        var result;
        if (asJson || renderView) {
          result = {};
        } else {
          result = req;
        }
        result[previousExportKey] = resolved[0];
        result[documentsExportKey] = resolved[1];
        result[nextExportKey] = resolved[2];
        // Terminate middleware working.
        if (asJson) {
          res.json(result);
        } else if (renderView) {
          res.render(renderView, result);
        } else {
          next();
        }
      });
    })).otherwise(function (error) {
      next(error);
    });
  };
};