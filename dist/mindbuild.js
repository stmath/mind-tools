#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _test = require('./lib/test');

var _git = require('./lib/git');

var _file = require('./lib/common/file');

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var optionDefinitions = [{ name: 'test', type: Boolean, defaultValue: false }, { name: 'tag', type: Boolean }, { name: 'upload', alias: 'u', type: String }, { name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }, { name: 'gameName', alias: 'b', type: Boolean }, { name: 'minify', alias: 'm', type: Boolean }, { name: 'gzip', alias: 'g', type: Boolean, defaultValue: false }];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
var log = console.log;

(0, _bundle.setLogHandler)(log);
var bundleName = (0, _bundle.getBundleName)();
if (options.gameName) {
	log(bundleName || '');
} else {
	if (bundleName == 'StarterGameTemplate') {
		log('Ignoring starter kit Example Game');
		process.exit(0);
	}
	if (options.test) {
		log('Running tests');
		if ((0, _test.testGame)()) {
			log('Tests passed with no errors');
		} else {
			log('Tests failed');
			process.exit(1);
		}
	}
	var version = void 0;
	(0, _file.mkdir)(options.dest);
	(0, _git.getLastTag)().then(function (res) {
		version = res;
		if (!version) {
			version = '0';
			log('No git tags finded, started with version 1');
		} else {
			log('Current tagged version: ' + version);
		}
		if (options.tag) {
			version = String(parseInt(version) + 1);
		}

		log('Bundling assets');
		return (0, _bundle.bundleAssets)(options.dest, options.gzip);
	}).then(function (_) {
		log('Bundling game');
		return (0, _git.getLastCommitHash)().then(function (hash) {
			var success = (0, _bundle.bundleGame)(version, options.dest, hash, options.minify, options.gzip);
			var promise = void 0;
			if (!success) {
				promise = Promise.reject(new Error('Error while bundling game.'));
			} else {
				if (options.upload) {
					promise = (0, _bundle.uploadBundle)(version);
				} else {
					promise = Promise.resolve();
				}
			}
			return promise;
		});
	}).then(function (_) {
		if (options.tag) {
			log('Tagging git branch with version: ' + version);
			return (0, _git.addTag)(version);
		} else {
			return Promise.resolve();
		}
	}).catch(function (err) {
		log(err.message);
		process.exit(1);
	});
}