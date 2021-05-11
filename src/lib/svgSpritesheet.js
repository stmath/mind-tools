
const Utils = require('../utils/Utils');
const fs = require('fs'); // from node
const path = require('path'); // from node
const DOMParser = require('xmldom').DOMParser;
const XMLSerializer = require('xmldom').XMLSerializer;
const ERROR_EXIT = 1;
const Packer = require('../utils/packing');
const Sorter = require('../utils/sorter');

module.exports = function (gulp, plugins, cmds, packageJson) {
	const DEFAULT_RESOLUTION = 1;
	const FIRST_INDEX = 0;
	let src = cmds[Utils.MIND_COMMAND_PREFIX + 'src'];
	let shouldCrop = Boolean(cmds[Utils.MIND_COMMAND_PREFIX + 'shouldCrop']);
	let shouldDefer = Boolean(cmds[Utils.MIND_COMMAND_PREFIX + 'shouldDefer']);
	let resolution = Number(cmds[Utils.MIND_COMMAND_PREFIX + 'resolution']);
	let frameBuffer = cmds[Utils.MIND_COMMAND_PREFIX + 'frameBuffer'] || FIRST_INDEX;
	frameBuffer = parseInt(frameBuffer);

	var FORMATS = {
		'json': { template: 'json.template', extension: 'json', trim: false },
		'jsonarray': { template: 'jsonarray.template', extension: 'json', trim: false },
		'pixi.js': { template: 'json.template', extension: 'json', trim: true }
	};

	function __defaultOptions (options) {
		if (Array.isArray(options.format)) {
			options.format = options.format.map(function (x) { return FORMATS[x]; });
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

	function _runTask () {
		if (src) {
			if (shouldCrop) {
				Utils.cropSvg(src);
			}

			if (fs.lstatSync(src).isDirectory()) {
				if (!src.endsWith('/')) {
					src = src + '/';
				}

				let themObj = {};
				let storedUseStrs = [];
				let storedSymbolsStrs = [];
				let files = fs.readdirSync(src);
				let options = {};
				options = options || {};
				__defaultOptions(options);
				// get folder name
				const folderName = path.basename(src);
				const outSvgName = folderName + '_spriteSheet.svg';
				let cleanSVGFiles = [];
				files.forEach((fileName, index) => {
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
