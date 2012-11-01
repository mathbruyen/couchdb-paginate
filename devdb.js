#!/usr/bin/env node
// (c) Mathieu Bruyen - http://mais-h.eu/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

// ## Database management script

var path = require('path');
var exec = require('child_process').exec;
var fs = require('fs');
var when = require('when');

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
  // #### Status
  //
  // Prints the status of the local database (running or stopped).
  status: function () {
    var deferred = when.defer();
    exec(couchcommand + ' -s', { cwd: __dirname }, function (error) {
      if (error) {
        deferred.resolve('Not running');
      } else {
        deferred.resolve('Running');
      }
    });
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
  }
};

// ### Execution
//
// Executes the script if direct invocation, do nothing otherwise to allow using it as a standard module.
if (process.argv[1] === path.join(__dirname, 'devdb.js')) {
  var func = module.exports[process.argv[2]];
  if (func) {
    func().then(function (value) {
      if (value) {
        console.log(value);
      }
      process.exit();
    },function (err) {
      console.log(err);
      process.exit(1);
    });
  } else {
    console.log('Usage: ./devdb.js {' + Object.keys(module.exports).join('|') + '}');
    process.exit(1);
  }
}
