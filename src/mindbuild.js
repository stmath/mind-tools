#!/usr/bin/env node
import {upload} from './lib/s3';
import {bundleGame, bundleAssets, setLogHandler} from './lib/bundle';
import {getLastTag, addTag} from './lib/git';

let bundleName;
let errorCode = 0;
const log = console.log;
const [,, ...args] = process.argv;
const index = args.indexOf('--name');

if (index < 0) {
	log('--name parameter required');
	errorCode = 65;
} else {
	bundleName = args[index + 1];
	if (typeof bundleName !== 'string' || bundleName.length === 0) {
		log('Invalid argument for --name');
		errorCode = 65;
	}
}

setLogHandler(log);

if (errorCode === 0) {
	getLastTag()
	.then(version => {
		if (!version) {
			version = '1';
			log(`No git tags finded, started with version: ${version}`);
		} else {
			log(`Current tagged version: ${version}`);
		}
		version = String(parseInt(version) + 1);
		log(`Tagging repo with version: ${version}`);
		return [addTag(version), version];
	})
	.then(res => {
		let [success, version] = res;
		let promise;
		if (success) {
			log('Bundling assets');
			bundleAssets();
			log('Bundling game');
			success = bundleGame(bundleName, version);
			if (!success) {
				promise = Promise.reject(new Error('Error on bundle game.'));
			} else {
				promise = uploadBundle(bundleName, version);
			}
			return promise;
		} else {
			log(`Error on setting git tag: ${version}`);
		}
		return result;
	})
	.then(res => {
		if (res) {
			log("Finish upload.");
		}
	})
	.catch(err => {
		log(err);
		process.exit(errorCode);
	})
}


const uploadBundle = (bundleName, version) => {
	return upload(`${bundleName}.js`,
		`pilot/arenas/${bundleName}/${version}/${bundleName}.js`,
		S3_BUCKET)
	.then(success => {
		if (success) {
			return upload(`${bundleName}.manifest.js`,
				`pilot/arenas/${bundleName}/manifest/${bundleName}.manifest.js`,
				S3_BUCKET);
		}
	});
}

const S3_BUCKET = 'mri-game-conversion';


