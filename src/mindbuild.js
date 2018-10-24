import {upload} from './lib/s3';


const uploadBundle = (bundleName, version) => {
	[`${bundleName}.js`, `${bundleName}.manifest.js`].forEach(file => {
		upload(`${BUNDLE_DIRECTORY}/${bundleName}/${file}`,
				`{pilot/arenas/${bundleName}/${version}/${file}`,
				S3_BUCKET);
	});
}

const BUNDLE_DIRECTORY = 'PixiArenas';
const S3_BUCKET = 'mri-game-conversion';
