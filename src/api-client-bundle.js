#!/usr/bin/env node
import commandLineArgs from 'command-line-args';
import {bundlePkg, setLogHandler} from './lib/jspm-pkg-bundle';

const optionDefinitions = [
	{ name: 'tag', alias: 't', type: String }, // Tag (Required)
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }, // Dist directory
	{ name: 'wfolder', alias: 'w', type: String, defaultValue: 'mind-api-client-library/' }, // Working directory
	{ name: 'source-map', alias: 's', type: Boolean}, // Add source map
	{ name: 'no-minify', alias: 'n', type: Boolean}, // No minify
	{ name: 'skip-install', alias: 'b', type: Boolean} // Skip install
];

const options = commandLineArgs(optionDefinitions);
const bundlePkgOptions = {
	dest: options.dest,
	wfolder: options.wfolder,
	sourceMap: options['source-map'],
	noMinify: options['no-minify'],
	skipInstall: options['skip-install'],
	bundleName: 'api-client-library'
};

setLogHandler(console.log);

const status = bundlePkg('mind-api-client-library', options.tag, bundlePkgOptions);

if (status.error) {
	if (status.stderr && status.stderr.pipe) {
		status.stderr.pipe(process.stderr);
	}
	if (status.stdout && status.stdout.pipe) {
		status.stdout.pipe(process.stdout);
	}
	process.exit(status.status || 1);
} else {
	process.exit(status.status || 0);
}
