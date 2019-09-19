#!/usr/bin/env node
import {bundleComponents, uploadBundleComponents, setLogHandler} from './lib/bundle';
import {addTag} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
	{ name: 'upload', alias: 'u', type: Boolean },
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'components/' },
	{ name: 'version', type: String },
	{ name: 'tag', type: Boolean},
];

const options = commandLineArgs(optionDefinitions);
const log = console.log;

setLogHandler(log);
let version = options.version;
mkdir(options.dest);
log(`Bundling Components to ${options.dest}${version}/`);
let success = bundleComponents(version, {sourceMap: options.sourceMap, noMinify: options.noMinify});
if (!success) new Error('Error while bundling Components.');
if (options.upload) {
	log('Upload bundle: ' + version);
	uploadBundleComponents(version);
}
if (options.tag) {
	log(`Tagging git branch with version: ${version}`);
	addTag(version);
}