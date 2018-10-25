#!/usr/bin/env node
import {upload} from './lib/s3';
import {getLastTag} from './lib/git';


const uploadBundle = (bundleName, version) => {
	let promise = Promise.resolve(true);
	[`${bundleName}.js`, `${bundleName}.manifest.js`].forEach(file => {
		promise = promise.then(sucess => { // upload in sequence.
			if (sucess) {
				return upload(`${BUNDLE_DIRECTORY}/${bundleName}/${file}`,
							`{pilot/arenas/${bundleName}/${version}/${file}`,
							S3_BUCKET);
			}
		}).catch(err => {
			console.log(err);
			return false;
		});
	});
}

// getLastTag().then(res => console.log(res));
const BUNDLE_DIRECTORY = 'PixiArenas';
const S3_BUCKET = 'mri-game-conversion';
