#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _git = require('./lib/git');

var _file = require('./lib/common/file');

var optionDefinitions = [{ name: 'tag', type: Boolean }, { name: 'upload', alias: 'u', type: String }, { name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }];

var commandLineArgs = require('command-line-args');
var options = commandLineArgs(optionDefinitions);
console.log(options);

var errorCode = 0;
var log = console.log;

(0, _bundle.setLogHandler)(log);

if (errorCode === 0) {
	var version = void 0;
	(0, _file.createDestFolder)(options.dest);
	(0, _git.getLastTag)().then(function (res) {
		version = res;
		if (!version) {
			version = '0';
			log('No git tags finded, started with version 1');
		} else {
			log('Current tagged version: ' + version);
		}
		version = String(parseInt(version) + 1);
		log('Bundling assets');
		return (0, _bundle.bundleAssets)(options.dest);
	}).then(function (_) {
		log('Bundling game');
		var success = (0, _bundle.bundleGame)(version, options.dest);
		var promise = void 0;
		if (!success) {
			promise = Promise.reject(new Error('Error while bundling game.'));
		} else {
			if (options.upload) {
				promise = (0, _bundle.uploadBundle)(bundleName, version);
			} else {
				promise = Promise.resolve();
			}
		}
		return promise;
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
} else {
	process.exit(errorCode);
}