#!/usr/bin/env node
'use strict';

var _file = require('./lib/common/file');

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var spawn = _child_process2.default.spawnSync;

var optionDefinitions = [{ name: 'tag', alias: 't', type: String }, // Tag (Required)
{ name: 'dest', alias: 'd', type: String, defaultValue: 'dist/' }, // Dist directory
{ name: 'wfolder', alias: 'w', type: String, defaultValue: 'mind-api-client-library/' }, // Working directory
{ name: 'source-map', alias: 's', type: Boolean }, // Add source map
{ name: 'no-minify', alias: 'n', type: Boolean }, // No minify
{ name: 'skip-install', alias: 'b', type: Boolean // Skip install
}];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
var log = console.log;
var exit = function exit() {
	var status = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { code: 0 };

	if (status.error) {
		status.stderr.pipe(process.stderr);
		status.stdout.pipe(process.stdout);
		process.exit(status.code || 1);
	} else {
		process.exit(status.code || 0);
	}
};
var tag = options.tag,
    dest = options.dest,
    wfolder = options.wfolder;


if (tag) {
	var baseFolder = process.cwd();
	var newDir = (0, _file.createPath)(wfolder);
	(0, _file.mkdir)(newDir);
	process.chdir(newDir);

	var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
	log('Installing mind-api-client-library');
	var status = { status: 0, error: false };
	if (!options['skip-install']) {
		status = spawn(command, ['install', 'mind:mind-api-client-library@' + tag, '-y'], { stdio: "inherit" });
	}
	if (!status.error && status.status === 0) {
		var extraParams = [];
		if (!options['source-map']) {
			extraParams.push('--skip-source-maps');
		}
		if (!options['no-minify']) {
			extraParams.push('--minify');
		}
		log('Bundling.');
		var bundleName = 'api-client-library-' + tag + '.js';
		log('Writing api-client-library-' + tag + '.js');
		status = spawn(command, ['bundle', 'mind-api-client-library/*', bundleName].concat(extraParams), { stdio: "inherit" });
		if (!status.error && status.status === 0) {
			process.chdir(baseFolder);
			(0, _file.mkdir)((0, _file.createPath)(dest));
			var newPath = (0, _file.createPath)(dest, bundleName);
			(0, _file.mv)(wfolder + '/' + bundleName, newPath);
			log('Bundle saved in ' + newPath);
			exit();
		}
	}
	exit(status);
} else {
	log('Missing tag parameter');
	exit({ code: 65 });
}