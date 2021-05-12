'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.convertSpritesheet = convertSpritesheet;
exports.generatePNG = generatePNG;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _puppeteer = require('puppeteer');

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _xmldom = require('xmldom');

var _sorter = require('./utils/sorter');

var _packing = require('./utils/packing');

var _utils = require('./utils/utils');

var _utils2 = _interopRequireDefault(_utils);

var _svgo = require('svgo');

var _svgo2 = _interopRequireDefault(_svgo);

var _file = require('./common/file');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ERROR_EXIT = 1;
var SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;

async function convertSpritesheet(folderPath) {
	var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	// Unique steps for this automated conversion:
	// 1: Extract outlines from all svg resources
	// 2: Crop all svg resources
	// 3: Optimize all svg resources (ensure this doesn't break step 1)
	// 4: Generate a PNG spritesheet from SVG resources

	// Expected manual steps:
	// 1: update the bundle object to include pngs
	// 2: update the theme files to ignore individual assets
	// 3: update the theme file to include the spritesheet url import
	// 4: update the theme file to include the spritesheet resource data as metadata for the spritesheet


	// TODO:
	// integrate svgCrop process, before optimize - NOTE: current implementation requires inkscape, which may be a non-starter

	// TODO: figure out why I can't resolve resolution

	var svgPromises = findAllSVGs(folderPath);
	Promise.all(svgPromises).then(function (values) {
		var svgs = values;

		var name = 'Composite';

		console.log('Extracting outline paths');
		writeOutlinesToJSON(folderPath, name, svgs);

		options.algorithm = options.hasOwnProperty('algorithm') ? options.algorithm : 'growing-binpacking';
		options.sort = options.hasOwnProperty('sort') ? options.sort : 'maxside';
		options.square = true;
		console.log('Precalculating SVG spritesheet size');
		__determineCanvasSize(svgs, options);

		var outSvgName = _path2.default.resolve(folderPath, 'compositeSVG_spriteSheet.svg');
		console.log('Constructing packed SVG spritesheet');
		__generateImage(svgs, options, outSvgName);

		console.log('Generating JSON data for mapping frames to resources');
		var themeJSON = __generateJSON(svgs, folderPath, 'compositeSVG');

		console.log('Converting spritesheet from SVG to PNG');
		var pngName = (0, _file.createPath)(folderPath, 'compositeSVG_spriteSheet.png');
		generatePNG(outSvgName, pngName, svgs, themeJSON);
	});

	/**
 
  */

	// TODO:
	// convert json info png consumable info

	// Edge cases:
	// Upright jiji - rseource urls are not literal
	// arenas that require multiple spritesheets
	// arenas that require multiple outlines
	// open package.json and rewrite mind.bundle-assets.assets
	// 
}

function extractOutlineFromString(fileStr) {
	var id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'outline';

	var outlineIndex = fileStr.indexOf('id="' + id + '"');
	if (outlineIndex < 0) outlineIndex = fileStr.indexOf('id=\'' + id + '\'');
	if (outlineIndex > 0) {
		// find the end of the element starting from the start of the outline id
		var endElement = fileStr.indexOf('/>', outlineIndex);
		var startElement = outlineIndex;
		// iterate backwards until we find the start of the element
		while (fileStr.charAt(startElement) !== '<') {
			startElement--;
		} // add all to a single line, and convert double quotes to single quotes
		var extractedPath = fileStr.slice(startElement, endElement + 1);
		var doubleQuote = /"/gi;
		var newline = /(\r\n|\n|\r)/gm;
		extractedPath = extractedPath.replace(doubleQuote, "'");
		extractedPath = extractedPath.replace(newline, "");
		return extractedPath;
	}
	return null;
}

function openFileForOutlines(folderPath, file) {
	var relativeSrc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;
	var outlinesToSearch = arguments[3];

	var resolvedPath = _path2.default.resolve(folderPath + '/' + file);
	var contents = _fs2.default.readFileSync(resolvedPath, { encoding: 'utf-8' });
	var extractedElements = [];

	for (var iter = 0; iter < outlinesToSearch.length; iter++) {
		var outlineId = outlinesToSearch[iter];
		// check for outline id in both single and double quotes
		var regexId = new RegExp(outlineId, "g");
		if (contents && regexId) {
			var allMatches = contents.match(regexId);
			if (allMatches) {
				for (var regexIter = 0; regexIter < allMatches.length; regexIter++) {
					var _outlineId = allMatches[regexIter];
					var extractedPath = extractOutlineFromString(contents, _outlineId);
					if (extractedPath) {
						extractedElements.push({ outlineId: _outlineId, extractedPath: extractedPath });
					}
				}
			}
		}
	}
	if (extractedElements.length > 0) {
		var name = relativeSrc !== undefined ? relativeSrc + '/' + file : folderPath + '/' + file;
		return { name: name, elements: extractedElements };
	}
	return undefined;
}

function writeOutlinesToJSON(filePath, name, svgFiles, relativeDir) {
	var outlineJSONStr = '{';
	for (var iter = 0; iter < svgFiles.length; iter++) {
		var file = svgFiles[iter];
		if (file.outlineData === undefined) continue;

		var fileName = file.name;
		if (relativeDir !== undefined) {
			fileName = relativeDir + fileName;
		}
		outlineJSONStr += '\n"' + fileName + '": {\n';
		for (var elemIter = 0; elemIter < file.elements.length; elemIter++) {
			var element = file.elements[elemIter];
			outlineJSONStr += '\t"' + element.outlineId + '": "' + element.extractedPath + '"';
			if (elemIter + 1 < file.elements.length) {
				outlineJSONStr += ',\n';
			} else {
				outlineJSONStr += '\n\t}';
			}
		}
		if (iter + 1 < svgFiles.length) {
			outlineJSONStr += ',';
		}
	}
	outlineJSONStr += '}';

	var outlinePath = (0, _file.createPath)(filePath, name + '_Outlines.json');
	_fs2.default.writeFileSync(outlinePath, outlineJSONStr);
}

function __optimizeSVG(data, pathName, options) {
	var prefix = true;

	var plugins = [{
		cleanupAttrs: true
	}, {
		cleanupEnableBackground: true
	}, {
		cleanupIDs: {
			remove: true,
			minify: false,
			prefix: '',
			preserve: [],
			preservePrefixes: [],
			force: false
		}
	}, {
		cleanupNumericValues: true
	}, {
		collapseGroups: true
	}, {
		convertShapeToPath: true
	}, {
		convertStyleToAttrs: true
	}, {
		convertColors: true
	}, {
		convertPathData: true
	}, {
		convertTransform: true
	}, {
		mergePaths: true
	}, {
		moveElemsAttrsToGroup: true
	}, {
		moveGroupAttrsToElems: true
	}, {
		removeDoctype: true
	}, {
		removeUnknownsAndDefaults: true
	}, {
		removeXMLProcInst: true
	}, {
		removeXMLNS: false // makes the svg disappear
	}, {
		removeComments: true
	}, {
		removeMetadata: true
	}, {
		removeTitle: true
	}, {
		removeDesc: true
	}, {
		removeUselessDefs: true
	}, {
		removeEditorsNSData: true
	}, {
		removeEmptyAttrs: true
	}, {
		removeHiddenElems: true
	}, {
		removeDimensions: false
	}, {
		removeEmptyText: true
	}, {
		removeEmptyContainers: true
	}, {
		removeViewBox: false
	}, {
		removeUnknownsAndDefaults: true
	}, {
		removeNonInheritableGroupAttrs: true
	}, {
		removeUselessStrokeAndFill: true
	}, {
		removeUnusedNS: true
	}, {
		removeRasterImages: false
	}, {
		sortAttrs: true
	}, {
		prefixIds: Boolean(prefix) === true ? {
			delim: '__',
			prefixIds: true,
			prefixClassNames: true
		} : false
	}];

	var svgoOpts = {
		plugins: plugins
	};

	var svgo = new _svgo2.default(svgoOpts);
	return svgo.optimize(data, { path: pathName }).then(function (result) {
		var didChange = result !== data;
		if (didChange) {
			try {
				_fs2.default.writeFileSync(pathName, result.data, 'utf8');
			} catch (e) {
				console.error(e);
			}
		}
	});
}

function __generateJSON(svgs, folderPath, fileNameRoot) {
	var themeObj = {};
	var DEFAULT_RESOLUTION = 1;
	// let resToUse = (!isNaN(file.resolution)) ? file.resolution :(!isNaN(resolution)) ? resolution : DEFAULT_RESOLUTION,
	var shouldDefer = false;
	// for each svg we need to store the data in a way that's consumable by the sdk
	svgs.forEach(function (file) {
		// add by name, include reference to original url, and dimensions
		themeObj[file.resourceName] = {
			name: file.name,
			resourceName: file.resourceName,
			url: file.url,
			type: 'image',
			metadata: {
				mipmap: true,
				resolution: file.resolution,
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
		console.log('defined resolution: ' + themeObj[file.resourceName].metadata.resolution);

		if (shouldDefer) {
			themeObj[file.name].metadata.defer = true;
			themeObj[file.name].defer = true;
		}
	});

	return themeObj;

	// TODO: SVG data is not needed, these json/js files are not required
	// store themeInfo in json
	/**
 const prettyPrintLevel = 4;
 let themObjJson = JSON.stringify(themObj, null, prettyPrintLevel);
 
 // write the xml
 let jsonFileName = fileNameRoot + '_spriteSheet.json'
 let jsonPath = path.resolve(folderPath, jsonFileName);
 fs.writeFileSync(jsonPath, themObjJson);
 let jsFileName = fileNameRoot + '_spriteSheet.js';
 let jsPath = path.resolve(folderPath, jsFileName);
 fs.writeFileSync(jsPath, `export default ${themObjJson.replace(/"/g, '\'')}`);
  */
}

function __generateImage(files, options, outSvgName) {
	var FIRST_INDEX = 0;
	// stored strings in an array so we can join them with newlines.
	// xlink is needed for safari to support <use> tag's href attribute
	var startSvgString = '<svg x="0" y="0" width="' + Math.ceil(options.atlases[FIRST_INDEX].width) + '" height="' + Math.ceil(options.atlases[FIRST_INDEX].height) + '" viewBox="0 0 ' + Math.ceil(options.atlases[FIRST_INDEX].width) + ' ' + Math.ceil(options.atlases[FIRST_INDEX].height) + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';
	var endSvgString = '</svg>';
	var storedSymbolsStrs = [];
	var storedUseStrs = [];

	files.forEach(function (fileData) {
		// xml does not like having multiple xml tags in one doc, lets remove them.
		var allTags = _utils2.default.getNodesByTagName('xml', fileData.svgDOM);
		for (var i in allTags) {
			var xmlTag = allTags[i];
			var parentNode = xmlTag.parentNode;
			parentNode.removeChild(xmlTag);
			// removeChild on xmldom library has a bug with updating children whose parent do not have ownerdocument.
			if (parentNode && !parentNode.ownerDocument) {
				var cs = parentNode.childNodes;

				var child = parentNode.firstChild;
				var _i = 0;
				while (child) {
					cs[_i++] = child;
					child = child.nextSibling;
				}
				cs.length = _i;
			}
		}

		var xmlSerializer = new _xmldom.XMLSerializer();
		var svgToString = xmlSerializer.serializeToString(fileData.svgDOM);
		var symbolId = '---SYMBOL---' + fileData.name;
		var symbolStr = '<symbol id="' + symbolId + '">' + svgToString.replace(/\s\s+/g, ' ') + '</symbol>';
		storedSymbolsStrs.push(symbolStr);

		// store the <use> tag. This will allow to translate each svg within the spritesheet.
		// xlink is needed for safari to support <use> tag's href attribute. xlink needs to be enabled in <svg> tag
		var useStr = '<use xlink:href="#' + symbolId + '" transform="translate(' + fileData.x + ', ' + fileData.y + ') scale(' + fileData.resolution + ' ' + fileData.resolution + ')" />';
		storedUseStrs.push(useStr);
	});

	var finalDocArr = [startSvgString].concat(storedSymbolsStrs).concat(storedUseStrs).concat([endSvgString]);
	var finalDocStr = '' + finalDocArr.join('\n');

	options.svgDOMString = finalDocStr.replace(/\s\s+/, ' '); // optimize by removing newline spaces.
	console.log(outSvgName);
	_fs2.default.writeFileSync(outSvgName, finalDocStr);
};

function __determineCanvasSize(files, options) {
	var frameBuffer = 1;
	// add a frame buffer to the values passed into the padding
	// this will force the resulting svg to include the given padding between each frame
	// this value is currently used for both the x and y coordinates
	files.forEach(function (item) {
		item.w = item.width + frameBuffer;
		item.h = item.height + frameBuffer;

		if (isNaN(options.width)) options.width = item.width;else options.width += item.width + frameBuffer;

		if (isNaN(options.height)) options.height = item.height;else options.height += item.height + frameBuffer;
	});

	if (options.square) {
		options.width = options.height = Math.max(options.width, options.height);
	}

	if (options.powerOfTwo) {
		options.width = roundToPowerOfTwo(options.width);
		options.height = roundToPowerOfTwo(options.height);
	}

	// sort files based on the choosen options.sort method
	console.log('will sort');
	(0, _sorter.run)(options.sort, files);
	console.log('will pack width: ' + options.width + ' height: ' + options.height);
	(0, _packing.pack)(options.algorithm, files, options);
}

function roundToPowerOfTwo(value) {
	var powers = 2;
	while (value > powers) {
		powers *= 2;
	}

	return powers;
}

function findAllSVGs(folderPath) {
	var promises = [];
	var resolvedAssetDir = _path2.default.resolve(folderPath);
	var type = 'svg';
	var results = _fs2.default.readdirSync(resolvedAssetDir); // {withFileTypes: true} should return Dirent objects, but not on build
	// files will now be strings that represent the names of the file or folder
	var files = results.filter(function (file) {
		return file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0;
	});
	files.forEach(function (file) {
		if (file.endsWith('_spriteSheet.svg')) {
			return;
		}
		var extractPromise = extractData(file, folderPath);
		promises.push(extractPromise);
	});

	var folders = results.filter(function (file) {
		return file.indexOf('.') < 0;
	});
	folders.forEach(function (folder) {
		var nextFolder = void 0;
		try {
			nextFolder = folderPath + '/' + folder;
			var nextSet = findAllSVGs(nextFolder);
			promises = promises.concat(nextSet);
		} catch (e) {
			console.log('unable to open ' + nextFolder);
		}
	});
	return promises;
}

async function extractData(file, folderPath) {
	var DEFAULT_RESOLUTION = 1;
	var filePath = folderPath + '/' + file;

	var outlineData = openFileForOutlines(folderPath, file, undefined, ['outline']);

	var resName = file.replace('.svg', '');
	var trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	// trimmedUrl = trimmedUrl.replace('../', '').replace('./', '') + outSvgName; todo this will need to reference the composite spritesheet
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;

	var srcPath = _path2.default.resolve('./PixiArenas/');

	var command = 'grep';
	var args = ['-F', '-R', filePath, srcPath];
	var spawn = _child_process2.default.spawnSync;
	var results = spawn(command, args);
	var resolution = DEFAULT_RESOLUTION;
	var resourceName = '';
	if (results && results.stdout) {
		var out = results.stdout.toString();
		var foundPath = out.split(':\t')[0];
		var fileBuffer = _fs2.default.readFileSync(foundPath, 'utf8');
		var idx = fileBuffer.indexOf(filePath);
		if (idx >= 0) {
			var startIdx = idx;
			var openBraceCount = 0;
			// TODO: use regex

			// find the open brace for this resource definition
			while (fileBuffer.charAt(startIdx) !== '{' || openBraceCount !== 0) {
				if (fileBuffer.charAt(startIdx) === '}') openBraceCount++;else if (fileBuffer.charAt(startIdx) === '{') openBraceCount--;
				startIdx--;
			}

			// find the name of the resource object based on the next property with quotes
			var resourceIdx = startIdx;
			var endQuoteIdx = -1;
			while (fileBuffer.charAt(resourceIdx) !== '\'' || endQuoteIdx === -1) {
				if (fileBuffer.charAt(resourceIdx) === '\'') endQuoteIdx = resourceIdx;
				resourceIdx--;
			}
			resourceName = fileBuffer.slice(resourceIdx + 1, endQuoteIdx);

			// find the end of the resource defintion by searching for the end brace relative to this start brace
			var endIdx = startIdx + 1;
			openBraceCount = 0;
			while (fileBuffer.charAt(endIdx) !== '}' || openBraceCount !== 0) {
				if (fileBuffer.charAt(endIdx) === '{') openBraceCount++;else if (fileBuffer.charAt(endIdx) === '}') openBraceCount--;
				endIdx++;
			}

			var resourceDefintion = fileBuffer.slice(startIdx, endIdx + 1);

			var resolutionIdx = resourceDefintion.indexOf('resolution');
			if (resolutionIdx >= 0) {
				while (isNaN(parseInt(resourceDefintion.charAt(resolutionIdx)))) {
					resolutionIdx++;
				}resolution = parseInt(resourceDefintion.charAt(resolutionIdx));
			} else {
				resolution = 2;
			}
		}
	}

	return __getSizeOfFile(filePath, resolution).then(function (res) {
		var svgData = res;
		svgData.name = resName;
		svgData.url = filePath;
		svgData.trimmedUrl = trimmedUrl;
		svgData.path = filePath;
		svgData.index = 'pending';
		svgData.extension = 'svg';
		svgData.outline = outlineData;
		svgData.resourceName = resourceName;
		svgData.resolution = resolution;
		return svgData;
	});

	// let svgData = await __getSizeOfFile(filePath);

	// including info from starterkit

	// find instances of the given file in the src folder (searching for theme definition)


	// return svgData;
}

function __getSizeOfFile(filePath, resolution) {
	var parser = new _xmldom.DOMParser();
	// read the file
	var fileBuffer = _fs2.default.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	var svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

	var fullPath = _path2.default.resolve(filePath);
	return __optimizeSVG(svgDom, fullPath, {}).then(function (result) {
		fileBuffer = _fs2.default.readFileSync(filePath, 'utf8');
		// white spaces generate too many text elems, lets remove them before parsing to xmldom.
		svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

		// finding out the dimensions
		var viewBoxAttr = svgDom.documentElement.getAttribute('viewBox');
		if (!viewBoxAttr) viewBoxAttr = svgDom.documentElement.getAttribute('viewbox');
		var viewBox = {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};

		if (viewBoxAttr) {
			var viewBoxArr = viewBoxAttr.replace(/\s\s+/g, ' ').split(' ');
			var xIndex = 0;
			var yIndex = 1;
			var wIndex = 2;
			var hIndex = 3;
			viewBox.x = Number(viewBoxArr[xIndex]) * resolution;
			viewBox.y = Number(viewBoxArr[yIndex]) * resolution;
			viewBox.width = Number(viewBoxArr[wIndex]) * resolution;
			viewBox.height = Number(viewBoxArr[hIndex]) * resolution;
			// adjust based on resolution
			svgDom.documentElement.setAttribute('viewbox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.width + ' ' + viewBox.height);
		} else {
			var DEFAULT_X = 0;
			var DEFAULT_Y = 0;
			var DEFAULT_WIDTH = 0;
			var DEFAULT_HEIGHT = 0;

			viewBox.x = Number(svgDom.documentElement.getAttribute('x').replace('px', '')) || DEFAULT_X;
			viewBox.y = Number(svgDom.documentElement.getAttribute('y').replace('px', '')) || DEFAULT_Y;
			viewBox.width = Number(svgDom.documentElement.getAttribute('width').replace('px', '')) || DEFAULT_WIDTH;
			viewBox.height = Number(svgDom.documentElement.getAttribute('height').replace('px', '')) || DEFAULT_HEIGHT;
		}

		var fileData = {};
		fileData.svgDOM = svgDom;
		fileData.width = viewBox.width;
		fileData.height = viewBox.height;
		fileData.area = viewBox.width * viewBox.height;
		fileData.processed = true;
		return fileData;
	});
}

async function generatePNG(svgSprtSheetPath, pngSpritesheetName, svgs, themeJSON) {
	svgSprtSheetPath = _path2.default.posix.join(svgSprtSheetPath);
	var svgString = _fs2.default.readFileSync(svgSprtSheetPath);

	var _getSvgSize = getSvgSize(svgString),
	    width = _getSvgSize.width,
	    height = _getSvgSize.height;
	// get the absolute path


	var dataUrl = 'file:///' + _path2.default.resolve(svgSprtSheetPath);

	var pathParsed = _path2.default.parse(svgSprtSheetPath);
	var newSpriteSheetURL = _path2.default.posix.join(pathParsed.dir, pathParsed.name + '.png');
	var targetName = pathParsed.name + '.png';
	var newTexturePackerDef = generateTexturePackerDef(svgs, targetName, width, height, themeJSON);
	var themeFileData = {
		url: pngSpritesheetName,
		metadata: {
			spriteSheetPng: newTexturePackerDef
		}
	};
	var savePath = _path2.default.posix.join(_path2.default.parse(svgSprtSheetPath).dir, _path2.default.parse(svgSprtSheetPath).name);
	console.log(savePath);

	var prettyPrintLevel = 4;
	var jsonString = JSON.stringify(themeFileData, null, prettyPrintLevel);
	_fs2.default.writeFileSync(savePath + ".json", jsonString);
	_fs2.default.writeFileSync(savePath + ".js", "export default " + jsonString);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width: width,
		height: height,
		fromPath: svgSprtSheetPath
	}).then(function () {
		console.log('PNG image has been saved from: ' + svgSprtSheetPath);
		_fs2.default.unlinkSync(svgSprtSheetPath);
	});
}

async function saveImg(_ref) {
	var url = _ref.url,
	    width = _ref.width,
	    height = _ref.height,
	    fromPath = _ref.fromPath;

	var browser = await _puppeteer2.default.launch({ headless: true });
	var page = await browser.newPage();

	var _path$parse = _path2.default.parse(fromPath),
	    name = _path$parse.name,
	    dir = _path$parse.dir;

	await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
	await page.setViewport({ width: width || 0, height: height || 0 });
	await page.screenshot({
		path: _path2.default.posix.join(dir, name + '.png'),
		type: "png",
		fullPage: true,
		omitBackground: true
	});
	await page.close();
	await browser.close();
}

var generateTexturePackerDef = function generateTexturePackerDef(svgs, newSpriteSheetURL, width, height, themeJSON) {
	var newTexturePackerDef = {
		frames: {},
		meta: {}
	};
	var isFirst = false;
	var keys = Object.keys(themeJSON);
	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var prop = _step.value;

			var key = prop;
			var assetInfo = themeJSON[prop];
			if (!isFirst) {
				newTexturePackerDef.meta = {
					app: "http://www.codeandweb.com/texturepacker",
					version: "1.0",
					image: newSpriteSheetURL,
					format: "RGBA8888",
					size: { "w": width, "h": height },
					scale: "1"
				};
				isFirst = true;
			}

			var frameInfo = assetInfo.metadata.spriteSheetSvg.frame;
			newTexturePackerDef.frames[key] = generateFrameInfo(frameInfo, newSpriteSheetURL);
			newTexturePackerDef.frames[key].originalUrl = assetInfo.url;
			if (assetInfo.metadata.resolution) newTexturePackerDef.frames[key].resolution;
		}
	} catch (err) {
		_didIteratorError = true;
		_iteratorError = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion && _iterator.return) {
				_iterator.return();
			}
		} finally {
			if (_didIteratorError) {
				throw _iteratorError;
			}
		}
	}

	return newTexturePackerDef;
};

var generateFrameInfo = function generateFrameInfo(frameInfo, newSpriteSheetURL) {
	return {
		"url": newSpriteSheetURL,
		"frame": {
			"x": frameInfo.x,
			"y": frameInfo.y,
			"w": frameInfo.width,
			"h": frameInfo.height
		}, // {"x":912,"y":0,"w":304,"h":372},
		"rotated": false,
		"trimmed": false,
		"spriteSourceSize": { "x": 0, "y": 0, "w": frameInfo.width, "h": frameInfo.height },
		"sourceSize": { "w": frameInfo.width, "h": frameInfo.height }
	};
};

var getSvgSize = function getSvgSize(svgString) {
	var sizeMatch = SVG_SIZE.exec(svgString);
	var size = {};
	if (sizeMatch) {
		size[sizeMatch[1]] = Math.round(parseFloat(sizeMatch[3]));
		size[sizeMatch[5]] = Math.round(parseFloat(sizeMatch[7]));
	}
	return size;
};