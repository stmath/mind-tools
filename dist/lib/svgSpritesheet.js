'use strict';

var Utils = require('../utils/Utils');
var fs = require('fs'); // from node
var path = require('path'); // from node
var DOMParser = require('xmldom').DOMParser;
var XMLSerializer = require('xmldom').XMLSerializer;
var ERROR_EXIT = 1;
var Packer = require('../utils/packing');
var Sorter = require('../utils/sorter');

module.exports = function (gulp, plugins, cmds, packageJson) {
	var DEFAULT_RESOLUTION = 1;
	var FIRST_INDEX = 0;
	var src = cmds[Utils.MIND_COMMAND_PREFIX + 'src'];
	var shouldCrop = Boolean(cmds[Utils.MIND_COMMAND_PREFIX + 'shouldCrop']);
	var shouldDefer = Boolean(cmds[Utils.MIND_COMMAND_PREFIX + 'shouldDefer']);
	var resolution = Number(cmds[Utils.MIND_COMMAND_PREFIX + 'resolution']);
	var frameBuffer = cmds[Utils.MIND_COMMAND_PREFIX + 'frameBuffer'] || FIRST_INDEX;
	frameBuffer = parseInt(frameBuffer);

	var FORMATS = {
		'json': { template: 'json.template', extension: 'json', trim: false },
		'jsonarray': { template: 'jsonarray.template', extension: 'json', trim: false },
		'pixi.js': { template: 'json.template', extension: 'json', trim: true }
	};

	function __defaultOptions(options) {
		if (Array.isArray(options.format)) {
			options.format = options.format.map(function (x) {
				return FORMATS[x];
			});
		} else if (options.format || !options.customFormat) {
			options.format = [FORMATS[options.format] || FORMATS['json']];
		}
		options.name = options.name || '_spriteSheet';
		options.spritesheetName = options.name;
		options.path = path.resolve(options.path || '.');
		options.fullpath = options.hasOwnProperty('fullpath') ? options.fullpath : false;
		options.square = options.hasOwnProperty('square') ? options.square : true;
		options.powerOfTwo = options.hasOwnProperty('powerOfTwo') ? options.powerOfTwo : false;
		options.extension = options.hasOwnProperty('extension') ? options.extension : options.format[FIRST_INDEX].extension;
		options.trim = options.hasOwnProperty('trim') ? options.trim : options.format[FIRST_INDEX].trim;
		options.algorithm = options.hasOwnProperty('algorithm') ? options.algorithm : 'growing-binpacking';
		options.sort = options.hasOwnProperty('sort') ? options.sort : 'maxside';
		options.padding = options.hasOwnProperty('padding') ? parseInt(options.padding, 10) : FIRST_INDEX;
		options.prefix = options.hasOwnProperty('prefix') ? options.prefix : '';
		options.divisibleByTwo = options.hasOwnProperty('divisibleByTwo') ? options.divisibleByTwo : false;
		options.cssOrder = options.hasOwnProperty('cssOrder') ? options.cssOrder : null;
	}

	function _runTask() {
		if (src) {
			if (shouldCrop) {
				Utils.cropSvg(src);
			}

			if (fs.lstatSync(src).isDirectory()) {
				if (!src.endsWith('/')) {
					src = src + '/';
				}

				var themObj = {};
				var storedUseStrs = [];
				var storedSymbolsStrs = [];
				var files = fs.readdirSync(src);
				var options = {};
				options = options || {};
				__defaultOptions(options);
				// get folder name
				var folderName = path.basename(src);
				var outSvgName = folderName + '_spriteSheet.svg';
				var cleanSVGFiles = [];
				files.forEach(function (fileName, index) {
					if (path.extname(fileName) === '.svg') {
						if (fileName.endsWith('_spriteSheet.svg')) {
							return;
						}
						cleanSVGFiles.push(fileData);
					}
				});

				__determineCanvasSize(cleanSVGFiles, options);
				__generateImage(cleanSVGFiles, options, src + outSvgName);

				// start with the big textures
				// while (collectedInfo.unusedNodes.length) {
				// _generateJSON()...;	


				process.exit();
			} else {
				console.error('Sorry, this command only works with directories.');
				process.exit(ERROR_EXIT);
			}
		} else {
			console.error('Please provide a source.');
			process.exit(ERROR_EXIT);
		}
	};

	// else return task function
	return _runTask;
};