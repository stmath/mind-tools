#!/usr/bin/env node
import {bundleGame, bundleAssets, uploadBundle, setLogHandler, getBundleName} from './lib/bundle';
import {testGame} from './lib/test';
import {getLastTag, addTag, getLastCommitHash} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
	{ name: 'test', type: Boolean, defaultValue: false},
	{ name: 'tag', type: Boolean},
	{ name: 'upload', alias: 'u', type: String },
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' },
	{ name: 'gameName', alias: 'b', type: Boolean},
	{ name: 'minify', alias: 'm', type: Boolean}
];

const options = commandLineArgs(optionDefinitions);
const log = console.log;

setLogHandler(log);
let bundleName = getBundleName();
if (options.gameName) {
	log(bundleName || '');
} else {
	if (bundleName == 'StarterGameTemplate') {
		log('Ignoring starter kit Example Game');
		process.exit(0);
	}
	if (options.test) {
		log('Running tests');
		if (testGame()) {
			log('Tests passed with no errors');
		} else {
			log('Tests failed');
			process.exit(1);
		}
	} 
	let version;
	mkdir(options.dest);
	getLastTag()
	.then(res => {
		version = res;
		if (!version) {
			version = '0';
			log('No git tags finded, started with version 1');
		} else {
			log(`Current tagged version: ${version}`);
		}
		if (options.tag) {
			version = String(parseInt(version) + 1);
		}
		
		log('Bundling assets');
		return bundleAssets(options.dest);
	})
	.then(_ => {
		log('Bundling game');
		return getLastCommitHash().then((hash) => {
			let success = bundleGame(version, options.dest, hash, options.minify);
			let promise;
			if (!success) {
				promise = Promise.reject(new Error('Error while bundling game.'));
			} else {
				if (options.upload) {
					promise = uploadBundle(version);
				} else {
					promise = Promise.resolve();
				}
			}
			return promise;	
		})
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
}