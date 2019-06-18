#!/usr/bin/env node
'use strict';

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

var _jspmPkgBundle = require('./lib/jspm-pkg-bundle');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var optionDefinitions = [{ name: 'tag', alias: 't', type: String }, // Tag (Required)
{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }, // Dist directory
{ name: 'wfolder', alias: 'w', type: String, defaultValue: 'mind-api-client-library/' }, // Working directory
{ name: 'source-map', alias: 's', type: Boolean }, // Add source map
{ name: 'no-minify', alias: 'n', type: Boolean }, // No minify
{ name: 'skip-install', alias: 'b', type: Boolean // Skip install
}];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
var bundlePkgOptions = {
	dest: options.dest,
	wfolder: options.wfolder,
	sourceMap: options['source-map'],
	noMinify: options['no-minify'],
	skipInstall: options['skip-install']
};

(0, _jspmPkgBundle.setLogHandler)(console.log);

var status = (0, _jspmPkgBundle.bundlePkg)('mind-sdk', options.tag, bundlePkgOptions);

if (status.error) {
	if (status.stderr && status.stderr.pipe) {
		status.stderr.pipe(process.stderr);
	}
	if (status.stdout && status.stdout.pipe) {
		status.stdout.pipe(process.stdout);
	}
	process.exit(status.status || 1);
} else {
	process.exit(status.status || 0);
}