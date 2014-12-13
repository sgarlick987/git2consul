var logger = require('../../logging.js');

// Set testing mode based on whether we're running in mocha or not.
var testing = (process.argv[1].indexOf('_mocha'), process.argv[1].length - 6) != -1;

/**
 * Set up a polling hook to update the git_manager on an interval.  This can
 * be a good failsafe so we aren't totally reliant on hooks making their way
 * to the system.
 */
exports.init = function(config, repo) {

  if (!config.interval || config.interval < 0 || parseInt(config.interval) != config.interval)
    throw 'Polling intervals must be positive integers'

  var start_branch_updater = function(branch) {
    logger.trace('Polling branch %s of repo %s', branch.name, repo.name);
    setInterval(function() {
      branch.handleRefChange(null, function(err) {
        /* istanbul ignore next */
        if (err) logger.error(err);
        logger.debug('Updates in branch %s complete', branch.name);
      });
    }, testing ? 1000 /* istanbul ignore next */ :
      config.interval * 60 * 1000);
  };

  repo.branch_names.forEach(function(branch_name) {
    var branch = repo.branches[branch_name];
    setTimeout(function() {
      start_branch_updater(branch);
      // Start the branch updater some random number of seconds from 1 to 30.  This is just to space
      // out the updates and reduce load spikes against git servers.
    }, testing ? 10 : /* istanbul ignore next */
      ((Math.floor((Math.random() * 30) + 1) ) * 1000)); // In the common case, start polling a random number of seconds later.
  });

  logger.debug('Polling hook initialized with %s minute intervals', config.interval);
};