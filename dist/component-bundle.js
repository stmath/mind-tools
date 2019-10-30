#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _git = require('./lib/git');

var _file = require('./lib/common/file');

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

var _test = require('./lib/test');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var optionDefinitions = [{ name: 'skipbundle', alias: 's', type: Boolean }, { name: 'dest', alias: 'd', type: String, defaultValue: 'components/' }, { name: 'version', alias: 'v', type: String }, { name: 'minify', type: Boolean, defaultValue: true }, { name: 'test', alias: 't', type: Boolean, defaultValue: false }, { name: 'gzip', alias: 'g', type: Boolean, defaultValue: false }];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
var log = console.log;

(0, _bundle.setLogHandler)(log);
if (options.test) {
	log('Running tests');
	if ((0, _test.testComponentBundle)()) {
		log('Tests passed with no errors');
	} else {
		log('Tests failed');
		process.exit(1);
	}
}
if (!options.skipbundle) {
	(0, _file.mkdir)(options.dest);
	var version = options.version;
	if (!version) {
		var recentTag = (0, _git.mostRecentTag)();
		if (recentTag) {
			recentTag = '' + recentTag;
			version = recentTag.trim();
		}
	}
	log('Bundling Components to ' + options.dest + version + '/');
	if (version) {
		var success = (0, _bundle.bundleComponents)(version, options.minify, options.gzip);
		if (!success) new Error('Error while bundling Components.');
	} else {
		new Error('Unable to apply a version.');
	}
} else {
	log('skipping component bundling');
}
process.exit(0);