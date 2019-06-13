#!/usr/bin/env node
import {mkdir, mv, createPath} from './lib/common/file';
import commandLineArgs from 'command-line-args';
import child_process from 'child_process';
import os from 'os';
const spawn = child_process.spawnSync;

const optionDefinitions = [
	{ name: 'tag', alias: 't', type: String }, // Tag (Required)
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }, // Dist directory
	{ name: 'wfolder', alias: 'w', type: String, defaultValue: 'mind-api-client-library/' }, // Working directory
	{ name: 'source-map', alias: 's', type: Boolean}, // Add source map
	{ name: 'no-minify', alias: 'n', type: Boolean}, // No minify
	{ name: 'skip-install', alias: 'b', type: Boolean} // Skip install
];

const options = commandLineArgs(optionDefinitions);
const log = console.log;
const exit = (status = {code: 0}) => {
	if (status.error) {
		status.stderr.pipe(process.stderr);
		status.stdout.pipe(process.stdout);
		process.exit(status.code || 1);
	} else {
		process.exit(status.code || 0);
	}
}
const {tag, dest, wfolder} = options;

if (options.tag) {
	const newDir = createPath(wfolder);
	mkdir(newDir);
	process.chdir(newDir);
	mkdir(dest);
	const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
	log('Installing mind-api-client-library');
	let status = {status: 0, error: false};
	if (!options['skip-install']) {
		status = spawn(command, ['install', `mind:mind-api-client-library@${tag}`, '-y'], {stdio: "inherit"});
	}
	if (!status.error && status.status === 0) {
		let extraParams = [];
		if (!options['source-map']) {
			extraParams.push('--skip-source-maps');
		}
		if (!options['no-minify']) {
			extraParams.push('--minify');
		}
		log('Bundling.');
		const bundleName = `api-client-library-${tag}.js`;
		log(`Writing api-client-library-${tag}.js`);
		status = spawn(command, ['bundle', 'mind-api-client-library/*', bundleName].concat(extraParams), {stdio: "inherit"});
		if (!status.error && status.status === 0) {
			const newPath = createPath(options.dest, bundleName);
			mv(bundleName, newPath);
			log(`Bundle saved in ${newPath}`);
			exit();
		}
	}
	exit(status);
} else {
	log('Missing tag parameter');
	exit({code: 65});
}

