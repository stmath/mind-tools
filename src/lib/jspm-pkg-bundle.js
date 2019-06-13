#!/usr/bin/env node
import {mkdir, mv, createPath} from './common/file';
import child_process from 'child_process';
import os from 'os';
const spawn = child_process.spawnSync;

let log = _ => {};

/**
 * Create a bundle based on jspm package.
 *
 * @export
 * @param {string} packageName: Package Name
 * @param {string|number} tag: tag or version
 * @param {object}: {
 *  noMinify: <boolean>,    // No minify
 *  sourceMap: <boolean>,   // Add source map
 *  skipInstall: <boolean>, // Skip install step
 *  wfolder: <string>,      // Working directory
 *  dest: <string>,         // Dist directory
 *  bundleName: <string>,   // Bundle name: Default is ${packageName}
 *  ns: <string>            // Package Namespace: Default mind.
 * }
 * @returns {object}: {status: <number>, error: boolean}
 */
export function bundlePkg (packageName, tag, {noMinify, sourceMap, skipInstall, wfolder, dest, bundleName, ns}) {
	let status = {status: 0, error: false};
	if (packageName && typeof packageName === 'string' && ['string', 'number'].includes(typeof tag)) {
		tag = String(tag);
		wfolder = wfolder || packageName;
		dest = dest || 'dist/';
		bundleName = bundleName || packageName;
		ns = ns || 'mind';

		const baseFolder = process.cwd();
		const workingFolder = createPath(wfolder);
		mkdir(workingFolder);
		process.chdir(workingFolder);

		const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
		log(`Installing ${packageName}`);
		if (!skipInstall) {
			status = spawn(command, ['install', `${ns}:${packageName}@${tag}`, '-y'], {stdio: "inherit"});
		}
		if (!status.error && status.status === 0) {
			let extraParams = [];
			if (!sourceMap) {
				extraParams.push('--skip-source-maps');
			}
			if (!noMinify) {
				extraParams.push('--minify');
			}
			log('Bundling.');
			const bundleFileName = `${bundleName}-${tag}.js`;
			log(`Writing ${bundleFileName}`);
			status = spawn(command, ['bundle', `${packageName}/*`, bundleFileName].concat(extraParams), {stdio: "inherit"});
			if (!status.error && status.status === 0) {
				process.chdir(baseFolder);
				mkdir(createPath(dest));
				const newPath = createPath(dest, bundleFileName);
				mv(`${wfolder}/${bundleFileName}`, newPath);
				log(`Bundle saved in ${newPath}`);
			}
		}
	} else {
		log(`Bad package name: ${packageName}@${tag}`);
		status = {error: true, status: 65};
	}
	return status;
}

/**
 * Set log function. E.g: console.log
 *
 * @param {object<function>} handlerFn: Function.
 * @returns
 */
export const setLogHandler = handlerFn => {
    if (typeof handlerFn === 'function') {
        log = handlerFn;
    }
};