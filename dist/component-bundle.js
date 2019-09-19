#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _git = require('./lib/git');

var _file = require('./lib/common/file');

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var optionDefinitions = [{ name: 'upload', alias: 'u', type: String }, { name: 'dest', alias: 'd', type: String, defaultValue: 'components/' }, { name: 'version', type: String }, { name: 'tag', type: Boolean }];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
var log = console.log;

(0, _bundle.setLogHandler)(log);
var version = options.version;
(0, _file.mkdir)(options.dest);
log('Bundling Components to ' + options.dest + version + '/');
var success = (0, _bundle.bundleComponents)(version, { sourceMap: options.sourceMap, noMinify: options.noMinify });
if (!success) new Error('Error while bundling Components.');
if (options.upload) {
	log('Upload bundle: ' + version);
	uploadBundle(version);
}
if (options.tag) {
	log('Tagging git branch with version: ' + version);
	(0, _git.addTag)(version);
}