import FS from 'fs';
import nectar from 'nectar';
import child_process from 'child_process';
import os from 'os';
import {getJsonFile, createPath} from './common/file';
import {upload} from './s3';

/**
 * Bundle assets defined in mind.bundle-assets.assets = [] & mind.bundle-assets.output = ''
 *
 * @returns
 */
export const bundleAssets = () => {
    const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    let ret = false;
    if (assets && output && assets.length > 0 && output.length > 0) {
        nectar(assets, output);
        ret = true;
    } else {
        logFn('No assets field on package.json. mind.bundle-assets.{assets | output}');
    }
    return ret;
};


/**
 * Bundle game in a promise which ends with true is succed.
 *
 * @param {string} name: Name of Game.
 * @param {string/number} version: Game version
 * @returns {boolean}: True if succeeds
 */
export const bundleGame = (name, version) => {
    name = name || getPackageJsonField('mind.name');
    let ret = false;
    if (typeof name === 'string' && name.length > 0) {
        const workingDirectory = getPackageJsonField('jspm.directories.lib');
        if (workingDirectory) {
            const spawn = child_process.spawnSync;
            // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
            const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
            const modulePath = createPath(workingDirectory, name, name);
            logFn(`Executing: jspm bundle ${modulePath} - mind-sdk/**/* ${name}.js.`);
            logFn(`Writing bundle ./${name}.js`);
            const res = spawn(command, ['bundle', `${modulePath} - mind-sdk/**/*`, `${name}.js`]);
            if (!res.error && res.status === 0) {
                logFn(`Writing manifest ./${name}.manifest.js`);
                writeManifest(name, modulePath, version);
                ret = true;
            } else {
                logFn(`Error: Jspm finish with status ${res.status} and error: ${res.error}.`);
            }
        } else {
            logFn('Can\t find jspm.directories.lib in package.json');
        }
    } else {
        logFn('No bundle name (mind.name) found in package.json');
    }
    return ret;
};

/**
 * Set log function. E.g: console.log
 *
 * @param {object<function>} handlerFn: Function.
 * @returns
 */
export const setLogHandler = handlerFn => {
    if (typeof handlerFn === 'function') {
        logFn = handlerFn;
    }
};

/**
 * Upload the given bundle.
 *
 * @param {string} name: Name of bundle file.
 * @param {string/number} version: Game version
 * @returns {object<Promise>}: Ends with true if succeeds.
 */
export const uploadBundle = (bundleName, version) => {
    bundleName = bundleName || getPackageJsonField('mind.name');
    let promise;
    if (typeof bundleName === 'string' && bundleName.length > 0) {
        let [s3folder, s3bucket] = [getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder,
                                getPackageJsonField('mind.aws.s3bucket') || DEFAULTS.s3bucket];

        const bundleKey = createPath(s3folder, bundleName, version, `${bundleName}.js`);
        const manifestKey = createPath(s3folder, bundleName, version, `${bundleName}.manifest.js`);

        logFn(`Uploading bundlet to S3: bucket: ${s3bucket}, key: ${bundleKey}`);
        promise = upload(`${bundleName}.js`, bundleKey, s3bucket)
            .then(success => {
                logFn(`Uploading manifest to S3: bucket: ${s3bucket}, key: ${manifestKey}`);
                if (success) {
                    return upload(`${bundleName}.manifest.js`, manifestKey, s3bucket);
                }
            });
    } else {
        promise = Promise.reject(new Error('Invalid bundle name'));
    }
    return promise;
}

const writeManifest = (name, arenakey, version) => {
    const sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    const folder = getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder;
    const manifest = {
        'module': name,
        'arenaKey': arenakey,
        'version' : version,
        'sdkBundleFile': `/pilot/sdk/mind-sdk-${sdkVersion}.js`,
        'gameBundleFile': createPath('/', folder, name, version, name + '.js'),
        'assetsBaseUrl': `/pilot`,
        'systemJsConfig': {
            'map': {
                'mind-sdk': `mind:mind-sdk@${sdkVersion}`
            }
        }
    };
    try {
        FS.writeFileSync(`${name}.manifest.js`, JSON.stringify(manifest, null, 2));
    } catch (e) {
        logFn(`Error writing manifest: ${e}`);
    }

};

const getPackageJsonField = field => {
	if (!getPackageJsonField.cache) {
		getPackageJsonField.cache = getJsonFile('package.json');
	}
    let retObj = getPackageJsonField.cache.content;
	if (typeof field === 'string' && field.length > 0) {
		field
            .split('.')
            .forEach(p => {
                retObj = retObj && retObj[p];
            });
    }
	return retObj;
};

const getPackageJsonFields = (ns = '', fields = undefined) => {
	let ret = [];
	if (typeof ns !== 'string') {
		ns = '';
	}
	if (Array.isArray(fields)) {
        ret = fields
            .filter(f => typeof f === 'string' && f.length > 0)
            .map(f => getPackageJsonField([ns, f].join('.')));
	}
	return ret;
};

let logFn = (_) => {};

const DEFAULTS = {
    s3bucket: 'mri-game-conversion',
    s3folder: '/pilot/arenas'
}