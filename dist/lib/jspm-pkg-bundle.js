#!/usr/bin/env node
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.setLogHandler = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.bundlePkg = bundlePkg;

var _file = require('./common/file');

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var log = function log(_) {};

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
function bundlePkg(packageName, tag, _ref) {
	var noMinify = _ref.noMinify,
	    sourceMap = _ref.sourceMap,
	    skipInstall = _ref.skipInstall,
	    wfolder = _ref.wfolder,
	    dest = _ref.dest,
	    bundleName = _ref.bundleName,
	    ns = _ref.ns,
	    noMangle = _ref.noMangle;

	var status = { status: 0, error: false };
	if (!checkJspm()) {
		log('Need jspm installed globally: npm install -g jspm.');
		status = { error: true, status: 1 };
	} else if (typeof packageName === 'string' && ['string', 'number'].includes(typeof tag === 'undefined' ? 'undefined' : _typeof(tag))) {
		tag = String(tag);
		wfolder = wfolder || packageName;
		dest = dest || 'dist/';
		bundleName = bundleName || packageName;
		ns = ns || 'mind';

		var baseFolder = process.cwd();
		var workingFolder = (0, _file.createPath)(wfolder);
		(0, _file.mkdir)(workingFolder);
		process.chdir(workingFolder);

		var spawn = _child_process2.default.spawnSync;
		var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
		if (!skipInstall) {
			log('Installing ' + packageName);
			status = spawn(command, ['install', ns + ':' + packageName + '@' + tag, '-y'], { stdio: 'inherit' });
		}
		if (!status.error && status.status === 0) {
			var extraParams = [];
			if (!sourceMap) {
				extraParams.push('--skip-source-maps');
			}
			if (!noMinify) {
				extraParams.push('--minify');
				if (noMangle) {
					extraParams.push('--no-mangle');
				}
			}
			log('Bundling.');
			var bundleFileName = bundleName + '-' + tag + '.js';
			log('Writing ' + bundleFileName);

			// mind-sdk requires a '/**/*' as a suffix, in order to bundle all files
			status = spawn(command, ['bundle', '' + packageName + (packageName === 'mind-sdk' ? '/**/*' : '/*'), bundleFileName].concat(extraParams), { stdio: 'inherit' });

			if (!status.error && status.status === 0) {
				process.chdir(baseFolder);
				(0, _file.mkdir)((0, _file.createPath)(dest));
				var newPath = (0, _file.createPath)(dest, bundleFileName);
				(0, _file.mv)(wfolder + '/' + bundleFileName, newPath);
				log('Bundle saved in ' + newPath);
			}
		}
	} else {
		log('Bad package name: ' + packageName + '@' + tag);
		status = { error: true, status: 65 };
	}
	return status;
}

/**
 * Set log function. E.g: console.log
 *
 * @param {object<function>} handlerFn: Function.
 * @returns
 */
var setLogHandler = exports.setLogHandler = function setLogHandler(handlerFn) {
	if (typeof handlerFn === 'function') {
		log = handlerFn;
	}
};

var checkJspm = function checkJspm(_) {
	var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
	var status = _child_process2.default.spawnSync(command, ['--version']);
	return status.output && Buffer.isBuffer(status.output[1]);
};