var should = require('should');
var _ = require('underscore');

var mkdirp = require('mkdirp');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Expand keys', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it ('should handle additions of new JSON files', function(done) {
    var sample_key = 'simple.json';
    var sample_value = '{ "first_level" : { "second_level": "is_all_we_need" } }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple.json/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle changing JSON files', function(done) {
    var sample_key = 'changeme.json';
    var sample_value = '{ "first_level" : "is_all_we_need" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, '{ "first_level" : "is super different" }', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is super different', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle busted JSON files', function(done) {
    var sample_key = 'busted.json';
    var sample_value = '{ "busted" ; "json" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/busted.json', sample_value, function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, '{ "not_busted" : "json" }', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/busted.json/not_busted', 'json', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle JSON files comingled with non-JSON files', function(done) {
    var json_key = 'happy.json';
    var json_value = '{ "happy" : "json" }';
    var sample_key = 'not_a_json_key';
    var sample_value = 'password: calvin12345';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(json_key, json_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
        git_utils.addFileToGitRepo(sample_key, sample_value, "Add another file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            // At this point, the repo should have populated consul with our sample_key
            consul_utils.validateValue('test_repo/master/happy.json/happy', 'json', function(err, value) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/not_a_json_key', sample_value, function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle JSON files with special characters', function(done) {
    var sample_key = 'special.json';
    var sample_value = {
      "fuzzy" : {
        "second level": "ain\'t no one got time for that",
        "second/level": {
          "ok?": "yes"
        }
      }
    };

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, JSON.stringify(sample_value), "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/special.json/fuzzy/second%20level', sample_value['fuzzy']['second level'], function(err, value) {
          // At this point, the repo should have populated consul with our sample_key
          consul_utils.validateValue('test_repo/master/special.json/fuzzy/second%2Flevel/ok%3F', sample_value['fuzzy']['second/level']['ok?'], function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });
});
