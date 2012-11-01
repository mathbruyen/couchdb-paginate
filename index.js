// (c) Mathieu Bruyen - http://mais-h.eu/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

var nano = require('nano');
var when = require('when');
// # CouchDB pagination
//
// [Connect](http://www.senchalabs.org/connect/) middleware for paginated [CouchDB](https://couchdb.apache.org/) views.
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
  // * `lowestKey`: lowest key to restrict explored range
  // * `uppermostKey`: uppermost key to restrict explored range
  // * `getStartKey` (default: fetch from query parameter called `start`): how to get requested page from the request
  //
  // `getStartKey` gets the request passed as an argument and may return `undefined` to indicate that it
  // searches the start page. It can also return a promise if it needs asynchronous working.
  //
  // TODO: make `lowestKey` and `uppermostKey` computable from the request too.
  var lowestKey = config.lowestKey;
  var uppermostKey = config.uppermostKey;
  var getStartKey = config.getStartKey || function (req) { return req.params.start; };
  if (typeof getStartKey != 'function') {
    throw new TypeError('"getStartKey" is not a function');
  }
  // ### Content to display
  //
  // * `pageSize` (default: `20`): number of items per page
  // * `nextNumber` (default: `1`): number of next links to compute
  // * `prevNumber` (default: the value of `nextNumber`): number of previous links to compute
  // * `useDocuments` (default: `false`): use documents instead of reduced values
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
  // ## Actual middleware
  return function (req, res, next) {
    when(getStartKey(req)).then(function (startKey) {
      var nextDef = when.defer();
      var previousDef = when.defer();
      var documentsDef = when.defer();
      // If start key is not provided, then use the lowermost one to get start page.
      if (startKey === undefined) {
        startKey = lowestKey;
      }
      // When fetching documents, use different requests to get next pages start keys and documents to limit response
      // size. Otherzise the content would be fetched anyway so get documents and next pages start keys in one request.
      if (useDocuments) {
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
      // If no next pages are requested no need to query extra documents at all.
      } else if (nextNumber === 0) {
        nextDef.resolve([]);
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
      } else {
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
      }
      // No need to query previous pages start keys if on the start page or if explicitely requested.
      if ((prevNumber > 0) && (startKey !== lowestKey)) {
        // Find all previous pages. `+ 2` because the first key of the current page is included and that the existence
        // of an extra document in order to detect first page properly.
        query(startKey, lowestKey, (prevNumber * pageSize) + 2, false, true).then(function (body) {
          var pages = [];
          for (var i = pageSize; i < body.rows.length && pages.length < prevNumber; i += pageSize) {
            pages.push(body.rows[i].key);
          }
          // If the response contains less items than expected then start page is included.
          if (body.rows.length !== (prevNumber * pageSize) + 2) {
            // Start page is actually the last one recorded.
            if (body.rows[body.rows.length - 1].key === pages[pages.length - 1]) {
              pages[pages.length - 1] = null;
            // Start page is an additional one if there is more than this page first element in the response.
            } else if (body.rows.length > 1) {
              pages.push(null);
            }
          }
          previousDef.resolve(pages);
        }, function (err) {
          previousDef.reject(err);
        });
      } else {
        previousDef.resolve([]);
      }
      return when.all([previousDef.promise, documentsDef.promise, nextDef.promise]).then(function (resolved) {
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
    }).otherwise(function (error) {
      next(error);
    });
  };
};