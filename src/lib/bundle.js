import FS from 'fs';
import nectar from 'nectar';
import child_process from 'child_process';
import os from 'os';
import {getJsonFile, createPath} from './common/file';

export const bundleAssets = () => {
    const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    let ret = false;
    if (assets && output && assets.length > 0 && output.length > 0) {
        nectar(assets, output);
        ret = true;
    } else {
        logFn("No assets found.")
    }
    return ret;
};

export const bundleGame = (name, version) => {
    let ret = false;
    if (typeof name === 'string' && name.length > 0) {
        const workingDirectory = getPackageJsonField('jspm.directories.lib');
        if (workingDirectory) {
            const spawn = child_process.spawnSync;
            // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
            const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
            const modulePath = createPath(workingDirectory, name, name);
            logFn(`Executing: jspm bundle ${modulePath} - mind-sdk/**/* ${name}.js.`);
            const res = spawn(command, ['bundle', `${modulePath} - mind-sdk/**/*`, `${name}.js`]);
            if (!res.error && res.status === 0) {
                logFn(`Writing manifest ${modulePath}/${name}.manifest.js`);
                writeManifest(name, modulePath, version);
                ret = true;
            } else {
                logFn(`Error: Jspm finish with status ${res.status} and error: ${res.error}.`);
            }
        } else {
            logFn('Can\t find jspm.directories.lib in package.json');
        }
    }
    return ret;
};

export const setLogHandler = handlerFn => {
    if (typeof handlerFn === 'function') {
        logFn = handlerFn;
    }
};

const writeManifest = (name, arenakey, version) => {
    const sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    const dump = `      {
        "module": "${name}",
        "arenaKey": "${arenakey}",
        "version" : "${version}",
        "sdkBundleFile": "/pilot/sdk/mind-sdk-${sdkVersion}.js",
        "gameBundleFile": "${createPath('/pilot/arenas', name, version, name + '.js')}",
        "assetsBaseUrl": "/pilot",
        "systemJsConfig": {
            "map": {
                "mind-sdk": "mind:mind-sdk@${sdkVersion}"
            }
        }
    }`;
    FS.writeFileSync(`${name}.manifest.js`, dump);
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