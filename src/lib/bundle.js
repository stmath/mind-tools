import FS from 'fs';
import nectar from 'nectar';
import child_process from 'child_process';
import os from 'os';
import {getJsonFile, createPath} from './common/file';

export const bundleAssets = () => {
	const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    if (assets && output && assets.length > 0 && output.length > 0) {
        nectar(assets, output);
    }
}

export function bundleGame (name, arenaKey, path, version) {
    const validParams = [name, arenaKey, path].find(p => typeof p !== 'string' || p.length === 0) === undefined;
    if (validParams) {
        const spawn = child_process.spawnSync;
        // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
        const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
        const res = spawn(command, ['bundle', `${path} - mind-sdk/**/*`, `${name}.js`]); // path : ${BUNDLE_DIRECTORY}/${gameName}/${gameName}
        if (!res.error && res.status === 0) {
            writeManifest(name, arenaKey, path, version);
        }
    }
};

const writeManifest = (gameName, arenaKey, path, version) => {
    if (path.endsWith('.js')) {
        path = path.substr(0, path.length - 3);
    }
    path = path.concat('.manifest.js');
    const sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    const dump = `{
        "module": "${gameName}",
        "arenaKey": "${arenaKey}",
        "version" : "${version}",
        "sdkBundleFile": "/pilot/sdk/mind-sdk-${sdkVersion}.js",
        "gameBundleFile": ${createPath('/pilot/arenas', gameName, version, gameName + '.js')},
        "assetsBaseUrl": "/pilot",
        "systemJsConfig": {
            "map": {
                "mind-sdk": "mind:mind-sdk@${sdkVersion}"
            }
        }
    }`;

    FS.writeFileSync(path, dump); // path: ${BUNDLE_DIRECTORY}/${gameName}/${gameName}.manifest.json
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
        ret = fields
            .map(f => typeof f === 'string' && f.length > 0)
            .map(f => getPackageJsonField([ns, f].join('.')));
	}
	return ret;
}