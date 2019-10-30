#!/usr/bin/env node
import {bundleComponents, uploadBundleComponents, setLogHandler} from './lib/bundle';
import {addTag, getTags, mostRecentTag} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';
import { testComponentBundle } from './lib/test';

const optionDefinitions = [
	{ name: 'skipbundle', alias: 's', type: Boolean},
	{ name: 'dest', alias: 'd', type: String, defaultValue: 'components/' },
	{ name: 'version', alias: 'v', type: String },
	{ name: 'minify', type: Boolean, defaultValue: true},
	{ name: 'test', alias: 't', type: Boolean, defaultValue: false},
	{ name: 'gzip', alias: 'g', type: Boolean, defaultValue: false}
];

const options = commandLineArgs(optionDefinitions);
const log = console.log;

setLogHandler(log);
if (options.test) {
	log('Running tests');
	if (testComponentBundle()) {
		log('Tests passed with no errors');
	} else {
		log('Tests failed');
		process.exit(1);
	}
}
if (!options.skipbundle) {
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
		let success = bundleComponents(version, options.minify, options.gzip);
		if (!success) new Error('Error while bundling Components.');
	}
	else {
		new Error('Unable to apply a version.');
	}
} else {
	log('skipping component bundling');
}
process.exit(0);