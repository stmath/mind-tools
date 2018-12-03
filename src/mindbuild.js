#!/usr/bin/env node
import {bundleGame, bundleAssets, uploadBundle, setLogHandler} from './lib/bundle';
import {getLastTag, addTag} from './lib/git';
import {createDestFolder} from './lib/common/file';

const optionDefinitions = [
	{ name: 'tag', type: Boolean},
	{ name: 'upload', alias: 'u', type: String },
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }
  ]

const commandLineArgs = require('command-line-args')
const options = commandLineArgs(optionDefinitions)
console.log(options);

let errorCode = 0;
const log = console.log;

setLogHandler(log);

if (errorCode === 0) {
	let version;
	createDestFolder(options.dest);
	getLastTag()
	.then(res => {
		version = res;
		if (!version) {
			version = '0';
			log('No git tags finded, started with version 1');
		} else {
			log(`Current tagged version: ${version}`);
		}
		version = String(parseInt(version) + 1);
		log('Bundling assets');
		return bundleAssets(options.dest);
	})
	.then(_ => {
		log('Bundling game');
		let success = bundleGame(version, options.dest);
		let promise;
		if (!success) {
			promise = Promise.reject(new Error('Error while bundling game.'));
		} else {
			if (options.upload) {
				promise = uploadBundle(bundleName, version);
			} else {
				promise = Promise.resolve();
			}
		}
		return promise;
	})
	.then(_ => {
		if (options.tag) {
			log(`Tagging git branch with version: ${version}`);
			return addTag(version);
		} else {
			return Promise.resolve();
		}
	})
	.catch(err => {
		log(err.message);
		process.exit(1);
	})
} else {
	process.exit(errorCode);
}
