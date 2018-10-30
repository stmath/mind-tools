#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _git = require('./lib/git');

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

var bundleName = void 0;
var errorCode = 0;
var log = console.log;

var _process$argv = _toArray(process.argv),
    args = _process$argv.slice(2);

var index = args.indexOf('--name');

if (index >= 0) {
	bundleName = args[index + 1];
	if (typeof bundleName !== 'string' || bundleName.length === 0) {
		log('Invalid argument for --name');
		errorCode = 65;
	}
}

(0, _bundle.setLogHandler)(log);

if (errorCode === 0) {
	var version = void 0;
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
		return (0, _bundle.bundleAssets)();
	}).then(function (_) {
		log('Bundling game');
		var success = (0, _bundle.bundleGame)(bundleName, version);
		var promise = void 0;
		if (!success) {
			promise = Promise.reject(new Error('Error while bundling game.'));
		} else {
			promise = (0, _bundle.uploadBundle)(bundleName, version);
		}
		return promise;
	}).then(function (_) {
		log('Tagging git branch with version: ' + version);
		return (0, _git.addTag)(version);
	}).catch(function (err) {
		log(err.message);
		process.exit(1);
	});
} else {
	process.exit(errorCode);
}