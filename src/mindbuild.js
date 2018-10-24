import FS from 'fs';
import nectar from 'nectar';
import child_process from 'child_process';
import os from 'os';
import {upload} from './lib/s3';

/**
 * Read and parse json file.
 * {
 *      content: {...} or undefined
 *      error: error string or undefined
 * }
 *
 * @param {string} jsonFile: File name.
 * @returns {object}:
 */
const getJsonFile = (jsonFile) => {
	let ret = { content: undefined, error: undefined };
	let rawData;
	if (typeof jsonFile === 'string' && jsonFile.length > 0) {
		try {
			rawData = FS.readFileSync(jsonFile, 'utf8');
		} catch (error) {
			ret.error = `Error: Fail to reading package.json. Exception: ${error}`;
		}
		if (rawData) {
			try {
				ret.content = JSON.parse(rawData);
			} catch (error) {
				ret.error = `Error: Can't parse json format. Exception: ${error}`;
			}
		}
	} else {
		ret.error = 'Error: Invalid file name.';
	}


	return ret;
}

const getPackageJsonField = field => {
	if (!getPackageJsonField.cache) {
		getPackageJsonField.cache = getJsonFile('package.json');
	}

	let retObj = getPackageJsonField.cache.content;
	if (typeof field === 'string' && field.length > 0) {
		retObj = field
				.split('.')
				.reduce(p => retObj[p] || {}, retObj);
	}
	return retObj;
}

const getPackageJsonFields = (ns = '', fields = undefined) => {
	let ret = [];
	if (typeof ns !== 'string') {
		ns = '';
	}
	if (Array.isArray(fields)) {
		ret = fields.map(f => getPackageJsonField(`${ns}.${f}`));
	}
	return ret;
}

const bundleAssets = () => {
	const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    if (assets && output && assets.length > 0 && output.length > 0) {
        nectar(assets, output);
    }
}

function bundleGame (gameName) {
	const spawn = child_process.spawnSync;
	// Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
	const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
	const res = spawn(command, ['bundle', `PixiArenas/${gameName}/${gameName} - mind-sdk/**/*`, `${gameName}.js`]);
	if (!res.error && res.status === 0) {
		writeManifest(gameName);
	}
};

const writeManifest = gameName => {
    const sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    const dump = `{
        "module": "${gameName}",
        "arenaKey": "PixiArenas/${gameName}/${gameName}",
        "sdkBundleFile": "/pilot/sdk/mind-sdk-${sdkVersion}.js",
        "gameBundleFile": "/pilot/arenas/${gameName}.js",
        "assetsBaseUrl": "/pilot",
        "systemJsConfig": {
            "map": {
                "mind-sdk": "mind:mind-sdk@${sdkVersion}"
            }
        }
    }`;

    FS.writeFileSync(`${BUNDLE_DIRECTORY}/${gameName}/${gameName}.manifest.json`, dump);
}

const uploadBundle = (bundleName, version) => {
	[`${bundleName}.js`, `${bundleName}.manifest.js`].forEach(file => {
		upload(`${BUNDLE_DIRECTORY}/${bundleName}/${file}`,
				`{pilot/arenas/${bundleName}-${version}/${file}`,
				S3_BUCKET);
	});
}

const contentType = fileName => {
	let contentType;
	if (typeof fileName !== 'string') {
		fileName = '';
	}
	const contentTypes = [
		['', 'application/octet-stream'],
		['.html', 'text/html'],
		['.css', 'text/css'],
		['.json', 'application/json'],
		['.js', 'application/x-javascript'],
		['.png', 'image/png'],
		['.jpg', 'image/jpg'],
		['.svg', 'image/svg+xml']
	];

	let type = contentTypes.pop();
	const name = fileName.toLowerCase()
	do {
		if (name.endsWith(type[0])) {
			contentType = type[1];
		}
		typé = contentTypes.pop();
	} while (contentType !== undefined);

	return contentType;
}

const BUNDLE_DIRECTORY = 'PixiArenas';
const S3_BUCKET = 'mri-game-conversion';