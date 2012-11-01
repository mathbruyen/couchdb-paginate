/*global module:false*/
module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-simple-mocha');

  grunt.initConfig({
    pkg: '<json:package.json>',
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    lint: {
      files: ['grunt.js', 'paginate.js', 'devdb.js']
    },
    simplemocha: {
      all: {
        src: 'test/*.js',
        options: {
          globals: ['should'],
          timeout: 3000,
          ignoreLeaks: false,
          ui: 'bdd',
          reporter: 'tap'
        }
      }
    },
    watch: {
      files: ['<config:lint.files>'],
      tasks: 'lint qunit'
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        node: true
      }
    },
    uglify: {}
  });

  grunt.registerTask('default', 'lint simplemocha');
};
