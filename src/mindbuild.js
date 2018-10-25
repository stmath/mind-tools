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
		} else {
			log.push(`Current tagged version: ${version}`);
		}
		version = String(parseInt(version) + 1);
		return [addTag(version), version];
	})
	.then((success, version) => {
		let res;
		if (success) {
			log(`Repo tagged with version: ${version}`);
			log('Bundling assets');
			bundleAssets();
			log('Bundling game');
			bundleGame(bundleName, version);
			log('Uploading bundle');
			res = uploadBundle(bundleName, version);
		} else {
			errorCode = 1;
			log(`Error on setting git tag: ${version}`);
		}
		return res;
	})
	.then(res => {
		log(res);
	})
	.catch(err => {
		log(err);
	});
}


const uploadBundle = (bundleName, version) => {
	let promise = Promise.resolve(true);
	[`${bundleName}.js`, `${bundleName}.manifest.js`].forEach(file => {
		promise = promise.then(sucess => { // upload in sequence.
			if (sucess) {
				return upload(`${BUNDLE_DIRECTORY}/${bundleName}/${file}`,
							`{pilot/arenas/${bundleName}/${version}/${file}`,
							S3_BUCKET);
			}
		})
	});
	return promise;
}

const BUNDLE_DIRECTORY = 'PixiArenas';
const S3_BUCKET = 'mri-game-conversion';

if (error) {
	console.log(error);
}
process.exit(errorCode);
