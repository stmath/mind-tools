
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

	function __generateImage (files, options, outSvgName) {
		// stored strings in an array so we can join them with newlines.
		// xlink is needed for safari to support <use> tag's href attribute
		let startSvgString = `<svg x="0" y="0" width="${Math.ceil(options.atlases[FIRST_INDEX].width)}" height="${Math.ceil(options.atlases[FIRST_INDEX].height)}" viewBox="0 0 ${Math.ceil(options.atlases[FIRST_INDEX].width)} ${Math.ceil(options.atlases[FIRST_INDEX].height)}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
		let endSvgString = '</svg>';
		let storedSymbolsStrs = [];
		let storedUseStrs = [];

		files.forEach((fileData) => {
			// xml does not like having multiple xml tags in one doc, lets remove them.
			let allTags = Utils.getNodesByTagName('xml', fileData.svgDOM);
			for (let i in allTags) {
				let xmlTag = allTags[i];
				let parentNode = xmlTag.parentNode;
				parentNode.removeChild(xmlTag);
					// removeChild on xmldom library has a bug with updating children whose parent do not have ownerdocument.
				if (parentNode && !parentNode.ownerDocument) {
					let cs = parentNode.childNodes;

					let child = parentNode.firstChild;
					let i = 0;
					while (child) {
						cs[i++] = child;
						child = child.nextSibling;
					}
					cs.length = i;
				}
			}
			let xmlSerializer = new XMLSerializer();
			let svgToString = xmlSerializer.serializeToString(fileData.svgDOM);
			let symbolId = `---SYMBOL---${fileData.name}`;
			let symbolStr = `<symbol id="${symbolId}">${svgToString.replace(/\s\s+/g, ' ')}</symbol>`;
			storedSymbolsStrs.push(symbolStr);

				// store the <use> tag. This will allow to translate each svg within the spritesheet.
			// xlink is needed for safari to support <use> tag's href attribute. xlink needs to be enabled in <svg> tag
			let useStr = `<use xlink:href="#${symbolId}" transform="translate(${fileData.x}, ${fileData.y})" />`;
			storedUseStrs.push(useStr);
		});
		let finalDocArr = [startSvgString].concat(storedSymbolsStrs).concat(storedUseStrs).concat([endSvgString]);
		let finalDocStr = `${finalDocArr.join(`
`)}`;

		options.svgDOMString = finalDocStr.replace(/\s\s+/, ' '); // optimize by removing newline spaces.
		fs.writeFileSync(outSvgName, finalDocStr);
	};

	function __determineCanvasSize (files, options) {
		// add a frame buffer to the values passed into the padding
		// this will force the resulting svg to include the given padding between each frame
		// this value is currently used for both the x and y coordinates
		files.forEach(function (item) {
			item.w = item.width + frameBuffer;
			item.h = item.height + frameBuffer;

			if (isNaN(options.width)) {
				options.width = item.width;
			}

			if (isNaN(options.height)) {
				options.height = item.height;
			} else {
				options.height += (item.height);
			}
			options.width += frameBuffer;
			options.height += frameBuffer;
		});

		if (options.square) {
			options.width = options.height = Math.max(options.width, options.height);
		}

		if (options.powerOfTwo) {
			options.width = roundToPowerOfTwo(options.width);
			options.height = roundToPowerOfTwo(options.height);
		}

		// sort files based on the choosen options.sort method
		Sorter.run(options.sort, files);

		Packer.pack(options.algorithm, files, options);
	}

	function roundToPowerOfTwo (value) {
		var powers = 2;
		while (value > powers) {
			// eslint-disable-next-line no-magic-numbers
			powers *= 2;
		}

		return powers;
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

				cleanSVGFiles.forEach((file, index) => {
					// store the info
					themObj[file.name] = {
						name: file.name,
						url: file.url,
						type: 'image',
						metadata: {
							mipmap: true,
							resolution: (!isNaN(resolution)) ? resolution : DEFAULT_RESOLUTION,
							spriteSheetSvg: {
								frame: {
									x: file.x,
									y: file.y,
									width: file.width,
									height: file.height
								}
							}
						}
					};

				// 	// 	// console.log(cmds);
						// if (cmds.defer) {
							// themObj[name].defer = true;
						// }
					if (shouldDefer) {
						themObj[file.name].metadata.defer = true;
						themObj[file.name].defer = true;
					}
				});

				// store themeInfo in json
				const prettyPrintLevel = 4;
				let themObjJson = JSON.stringify(themObj, null, prettyPrintLevel);

				// write the xml
				fs.writeFileSync(src + folderName + '_spriteSheet.json', themObjJson);
				fs.writeFileSync(src + folderName + '_spriteSheet.js', `export default ${themObjJson.replace(/"/g, '\'')}`);
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
