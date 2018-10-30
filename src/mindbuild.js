#!/usr/bin/env node
import {bundleGame, bundleAssets, uploadBundle, setLogHandler} from './lib/bundle';
import {getLastTag, addTag} from './lib/git';

let bundleName;
let errorCode = 0;
const log = console.log;
const [,, ...args] = process.argv;
const index = args.indexOf('--name');

if (index >= 0) {
	bundleName = args[index + 1];
	if (typeof bundleName !== 'string' || bundleName.length === 0) {
		log('Invalid argument for --name');
		errorCode = 65;
	}
}

setLogHandler(log);

if (errorCode === 0) {
	let version;
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
		bundleAssets();
		log('Bundling game');
		let success = bundleGame(bundleName, version);
		let promise;
		if (!success) {
			promise = Promise.reject(new Error('Error while bundling game.'));
		} else {
			promise = uploadBundle(bundleName, version);
		}
		return promise;
	})
	.then(_ => {
		log(`Tagging git branch with version: ${version}`);
		return addTag(version);
	})
	.catch(err => {
		log(err.message);
		process.exit(1);
	})
} else {
	process.exit(errorCode);
}
