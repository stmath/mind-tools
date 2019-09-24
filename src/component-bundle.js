#!/usr/bin/env node
import {bundleComponents, uploadBundleComponents, setLogHandler} from './lib/bundle';
import {addTag, getTags, mostRecentTag} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'components/' },
	{ name: 'version', type: String }
];

const options = commandLineArgs(optionDefinitions);
const log = console.log;

setLogHandler(log);
mkdir(options.dest);
let version = options.version;
if (!version) {
	let recentTag = mostRecentTag();
	if (recentTag) {
		recentTag = '' + recentTag;
		version = recentTag.trim();
	}
}
log(`Bundling Components to ${options.dest}${version}/`);
if (version) {
	let success = bundleComponents(version, {sourceMap: options.sourceMap, noMinify: options.noMinify});
	if (!success) new Error('Error while bundling Components.');
}
else {
	new Error('Unable to apply a version.');
}