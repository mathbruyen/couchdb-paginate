#!/usr/bin/env node
// (c) Mathieu Bruyen - http://mais-h.eu/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

// ## Database management script

var path = require('path');
var exec = require('child_process').exec;
var fs = require('fs');
var when = require('when');

var dbId = 1;

// ### Preparation
//
// Database is stored in `db` directory.
var dbdir = path.join(__dirname, 'db');

// Use local `couchdb.ini` configuration file to override globals, store running PID in local directory and redirect
// out and error streams to files in local directory.
var couchcommand = 'couchdb' +
  ' -a ' + path.join(__dirname, 'couchdb.ini') +
  ' -p ' + path.join(dbdir, 'couchdb.pid') +
  ' -o ' + path.join(dbdir, 'couchdb.stdout') +
  ' -e ' + path.join(dbdir, 'couchdb.stderr');

// Helper function to remove a directory with all files and directories (recursively) inside it.
function recursiveUnlinkSync(directory) {
  fs.readdirSync(directory).forEach(function (filename) {
    var file = path.join(directory, filename);
    if (fs.statSync(file).isDirectory()) {
      recursiveUnlinkSync(file);
    } else {
      fs.unlinkSync(file);
    }
  });
  fs.rmdirSync(directory);
}

// Helper function to check whether a simple object is contained in an array.
var contains = function (arr, item) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === item) {
      return true;
    }
  }
  return false;
};

// ### Actual scripts
module.exports = {
  // #### Start
  //
  // Starts the development database.
  start: function () {
    var deferred = when.defer();
    var child = exec(couchcommand + ' -b', { cwd: __dirname });
    child.on('exit', function (code) {
      if (code === 0) {
        setTimeout(deferred.resolve, 1000);
      } else {
        deferred.reject('Error');
      }
    });
    return deferred.promise;
  },
  // #### Stop
  //
  // Stops the development database.
  stop: function () {
    var deferred = when.defer();
    exec(couchcommand + ' -k', { cwd: __dirname }, deferred.resolve);
    return deferred.promise;
  },
  // #### Devdb
  //
  // Cleans the local directory and spawns a new empty database.
  devdb: function () {
    return when(module.exports.stop()).then(function () {
      if (fs.existsSync(dbdir)) {
        recursiveUnlinkSync(dbdir);
      }
      fs.mkdirSync(dbdir);
      return module.exports.start();
    });
  },
  // #### Document pre loading
  //
  // Loads some documents in a freshly created database.
  load: function (documents, nameds) {
    var nano = require('nano')('http://localhost:5984');
    var dbname = 'test' + (dbId++);
    var deferred = when.defer();
    nano.db.create(dbname, function () {
      deferred.resolve(nano.use(dbname));
    });
    return deferred.promise.then(function (db) {
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
};
