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

var _xmldom = require('xmldom');

var _sorter = require('./utils/sorter');

var _packing = require('./utils/packing');

var _utils = require('./utils/utils');

var _utils2 = _interopRequireDefault(_utils);

var _svgo = require('svgo');

var _svgo2 = _interopRequireDefault(_svgo);

var _file = require('./common/file');

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ERROR_EXIT = 1;
var SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;
var DEFAULT_RESOLUTION = 1;
var TACTILE_SUFFIX = '_tactile';

var themeBuffers = {};
var DEBUG_ENABLED = false;

async function convertSpritesheet(folderPath, name) {
	var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

	// Unique steps for this automated conversion:
	// 1: Extract outlines from all svg resources
	// 2: Crop all svg resources
	// 3: Optimize all svg resources (ensure this doesn't break step 1)
	// 4: Generate a PNG spritesheet from SVG resources
	DEBUG_ENABLED = options.debugEnabled;

	var svgPromises = findAllSVGs(folderPath, options);
	Promise.all(svgPromises).then(function (values) {
		var svgs = [];
		// clean away any undefined properties in values;
		for (var svgIter = 0; svgIter < values.length; svgIter++) {
			if (values[svgIter] != undefined) {
				// we only want the first resource to be added to svg spritesheet
				var svgInstance = values[svgIter].shift();
				svgs.push(svgInstance);
				// other resources will need to be written in but should not be part of the spritesheet
				svgInstance.duplicateDefs = values[svgIter];
			}
		}

		// all opened buffers for theme objects should be saved
		if (options.rewriteTheme) {
			var keys = Object.keys(themeBuffers);
			for (var iter = 0; iter < keys.length; iter++) {
				var filePath = keys[iter];
				logFn('Rewriting theme file: ' + filePath);
				_fs2.default.writeFileSync(filePath, themeBuffers[filePath], 'utf8');
			}
		}

		logFn('Extracting outline paths');

		var _writeOutlinesToJSON = writeOutlinesToJSON(folderPath, name, svgs),
		    relativeOutlinePath = _writeOutlinesToJSON.relativeOutlinePath,
		    hasOutlineElements = _writeOutlinesToJSON.hasOutlineElements;

		options.algorithm = options.hasOwnProperty('algorithm') ? options.algorithm : 'growing-binpacking';
		options.sort = options.hasOwnProperty('sort') ? options.sort : 'maxside';
		options.square = true;
		logFn('Precalculating SVG spritesheet size');
		__determineCanvasSize(svgs, options);

		var outSvgPath = _path2.default.resolve(folderPath, name + '_spriteSheet.svg');
		logFn('Constructing packed SVG spritesheet');
		__generateSVGSpritesheet(svgs, options, outSvgPath);

		logFn('Generating JSON data for mapping frames to resources');
		var themeJSON = __generateJSON(svgs);

		if (options.removeSVGs) {
			logFn('Remove SVG files added to spritesheet');
			var parsedSVGs = Object.keys(svgs);
			for (var _iter = 0; _iter < parsedSVGs.length; _iter++) {
				var svgData = svgs[parsedSVGs[_iter]];
				var pathToRemove = _path2.default.resolve(svgData.url);
				// validate file existence then remove
				if (_fs2.default.existsSync(pathToRemove)) _fs2.default.unlinkSync(pathToRemove);
			}
		}

		logFn('Converting spritesheet from SVG to PNG');
		var pngName = name + '_spriteSheet';
		var pngPath = (0, _file.createPath)(folderPath, pngName + '.png');
		// generate and save the js class that stores frame info for spritesheets
		generatePNGjs(outSvgPath, pngName, pngPath, svgs, themeJSON, options);
		// include imports for the png js file into the game theme
		writeThemeImport(pngName, hasOutlineElements, relativeOutlinePath, options);
		// convert the generated svg spritesheet into a png spritesheet
		generatePNG(outSvgPath, pngPath);
	});
}

function logFn(str) {
	var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

	if (DEBUG_ENABLED || force) {
		console.log(str);
	}
}

function writeThemeImport(name, hasOutlineElements, relativeOutlinePath, options) {
	var gameName = options.gameName;
	var rootSrc = 'PixiArenas/' + gameName;
	// by convention main theme files should:
	// 1) be located at the top of the game specific directory PixiArenas/GameName
	// 2) be named with the game name followed by Theme.js
	// 3) include a export for gameStyles
	var gameThemePath = _path2.default.resolve(rootSrc + '/' + gameName + 'Theme.js');
	var readBuffer = _fs2.default.readFileSync(gameThemePath);
	var importidx = readBuffer.lastIndexOf('import');
	var endImports = readBuffer.indexOf('\n', importidx);
	if (importidx > 0 && endImports > 0) {
		// write the import line for the spritesheet
		var relativeSpritesheet = '.' + options.spritesheetLoc.split(rootSrc)[1];
		var importString = '\nimport { default as ' + name + 'Data } from \'' + relativeSpritesheet + '/' + name + '.js\';\n';
		readBuffer = readBuffer.slice(0, endImports) + importString + readBuffer.slice(endImports + 1);
	} else {
		logFn('unable to resolve location for import of spritesheet data', true);
		return;
	}

	var gameStyleIdx = readBuffer.indexOf('gameStyles');
	if (gameStyleIdx >= 0) {
		// write the import for the spritesheet data at the top of the gameStyles object
		var styleIdx = readBuffer.indexOf('\n', gameStyleIdx);
		var includeStyle = '\n\t' + name + ': ' + name + 'Data,\n';

		if (hasOutlineElements) {
			includeStyle += '\t' + name + 'Outlines: {\n\t\turl: \'/' + relativeOutlinePath + '\',\n\t\tmetadata: {\n\t\t\tisOutline: ' + true + '\n\t\t}\n\t},\n';
		}

		readBuffer = readBuffer.slice(0, styleIdx) + includeStyle + readBuffer.slice(styleIdx + 1);
	} else {
		logFn('Unable to resolve location for spritesheet theme in the game styles', true);
		return;
	}

	// overwrite theme data with updated file
	logFn('Add spritesheet import to: ' + gameThemePath);
	_fs2.default.writeFileSync(gameThemePath, readBuffer);
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
		extractedPath = extractedPath.replace(newline, " ");
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
		name = '/' + name;
		return { name: name, elements: extractedElements };
	}
	return undefined;
}

function writeOutlinesToJSON(filePath, name, svgFiles, relativeDir) {
	var outlineJSONStr = '{';
	var initialJSON = true;
	var hasOutlineElements = false;
	for (var iter = 0; iter < svgFiles.length; iter++) {
		var file = svgFiles[iter];
		if (!file || file.outline === undefined) continue;

		var fileName = file.outline.name;
		if (relativeDir !== undefined) {
			fileName = relativeDir + fileName;
		}

		// 
		if (!initialJSON) outlineJSONStr += ',';
		if (initialJSON) initialJSON = false;

		outlineJSONStr += '\n"' + fileName + '": {\n';
		var elements = file.outline.elements;
		for (var elemIter = 0; elemIter < elements.length; elemIter++) {
			hasOutlineElements = true;
			var element = elements[elemIter];
			outlineJSONStr += '\t"' + element.outlineId + '": "' + element.extractedPath + '"';
			if (elemIter + 1 < elements.length) {
				outlineJSONStr += ',\n';
			} else {
				outlineJSONStr += '\n\t}';
			}
		}
	}
	outlineJSONStr += '\n}';

	var relativePath = (0, _file.createPath)(filePath, name + '_Outlines.json');
	if (hasOutlineElements) {
		var resolvedPath = _path2.default.resolve(relativePath);
		_fs2.default.writeFileSync(resolvedPath, outlineJSONStr);
		logFn('Write outlines to: ' + resolvedPath);
	} else {
		logFn('Skip Outlines.json - no outline elements found', true);
		logFn('DEBUG - file will be written anyway');
		hasOutlineElements = true;
		var _resolvedPath = _path2.default.resolve(relativePath);
		_fs2.default.writeFileSync(_resolvedPath, outlineJSONStr);
	}
	// TODO:
	// Return info regaring the outline path if written.
	return { relativeOutlinePath: relativePath, hasOutlineElements: hasOutlineElements };
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

function __generateJSON(svgs) {
	var themeObj = {};
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

		if (shouldDefer) {
			themeObj[file.name].metadata.defer = true;
			themeObj[file.name].defer = true;
		}

		if (file.duplicateDefs) {
			for (var iter = 0; iter < file.duplicateDefs.length; iter++) {
				var dupDef = file.duplicateDefs[iter];
				logFn('Adding duplicate resource definition: ' + dupDef.resourceName);
				var key = dupDef.resourceName;
				themeObj[key] = Object.assign({}, themeObj[file.resourceName]);
				themeObj[key].name = dupDef.name;
				themeObj[key].resourceName = dupDef.resourceName;
				themeObj[key].metadata.resolution = dupDef.resolution;
			}
		}
	});

	return themeObj;
}

function __generateSVGSpritesheet(files, options, outSvgName) {
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
		var symbolId = '---SYMBOL---' + fileData.url + '_' + fileData.name;
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
	(0, _sorter.run)(options.sort, files);
	(0, _packing.pack)(options.algorithm, files, options);
}

function roundToPowerOfTwo(value) {
	var powers = 2;
	while (value > powers) {
		powers *= 2;
	}

	return powers;
}

function findAllSVGs(folderPath, options) {
	var promises = [];
	var resolvedAssetDir = _path2.default.resolve(folderPath);
	var type = 'svg';
	// find all directory elements within the given directory
	var results = _fs2.default.readdirSync(resolvedAssetDir);
	// files will now be strings that represent the names of the file or folder
	var files = results.filter(function (file) {
		return file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0;
	});
	files.forEach(function (file) {
		// ignore any _spriteSheet files
		if (file.endsWith('_spriteSheet.svg') || file.endsWith('_spriteSheet.png')) return;
		// extract data from the given file
		var extractPromise = extractData(file, folderPath, options);
		if (extractPromise) promises.push(extractPromise);
	});
	// iterate over all folders in the directory to find more files
	var folders = results.filter(function (file) {
		return file.indexOf('.') < 0;
	});
	folders.forEach(function (folder) {
		var nextFolder = void 0;
		try {
			// find all sub files in the folder and manage promises from extract data
			promises = promises.concat(findAllSVGs(folderPath + '/' + folder, options));
		} catch (e) {
			logFn('unable to open ' + nextFolder, true);
		}
	});
	return promises;
}

async function extractData(file, folderPath, options) {
	var filePath = folderPath + '/' + file;
	logFn('Parse file: ' + filePath);
	var resName = file.replace('.svg', '');
	// trim the url to remove any relative directory information
	var trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;
	// extract outline elements from this svg file, given the set of options 
	var outlineData = openFileForOutlines(folderPath, file, undefined, options.outlineIds);
	// extract expected resolution and resourceName from arena's theme definitions
	var extractedData = extractThemeInfo(filePath, options);
	if (!extractedData) {
		logFn('Resource not found in theme: ' + filePath, true);
		return;
	}

	// the first instance of the extracted data will define the resolution for the resource
	// this may need to be reoncisdered to either, use the max resolution or create separate svg instances for each unique resolution
	var resolution = extractedData[0].resolution;

	// parse the file to determine the expected dimensions of the rasterized SVG
	return __getSizeOfFile(filePath, resolution, options).then(function (res) {
		var svgData = [];
		for (var iter = 0; iter < extractedData.length; iter++) {
			var svgDatum = Object.assign({}, res);
			svgDatum.name = resName;
			svgDatum.url = filePath;
			svgDatum.trimmedUrl = trimmedUrl;
			svgDatum.path = filePath;
			svgDatum.outline = outlineData;

			svgDatum.resourceName = extractedData[iter].resourceName;
			svgDatum.resolution = extractedData[iter].resolution;

			svgData.push(svgDatum);
		}
		return svgData;
	});
}

function runGrep(searchString, searchPath) {
	var command = 'grep';
	var args = ['-F', '-R', searchString, searchPath];
	var spawn = _child_process2.default.spawnSync;
	return spawn(command, args);
}

function parseResourceDef(pathToResource, resUrl) {
	var styleSuffix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;
	var options = arguments[3];

	var resolution = DEFAULT_RESOLUTION; // resolution defined by the resource
	var resourceName = ''; // id for the resource found in the theme file
	var extractedResources = [];
	var fileBuffer = themeBuffers[pathToResource];
	if (!fileBuffer) fileBuffer = _fs2.default.readFileSync(pathToResource, 'utf8');
	var idx = fileBuffer.indexOf(resUrl);
	while (idx >= 0) {
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
		while (fileBuffer.charAt(resourceIdx) !== ':') {
			resourceIdx--;
		}var colonIdx = resourceIdx;
		resourceIdx--;
		if (fileBuffer.charAt(resourceIdx) === '\'' || fileBuffer.charAt(resourceIdx) === '"') {
			// find closing quote:
			var targetQuote = fileBuffer.charAt(resourceIdx);
			var quoteIdx = resourceIdx;
			resourceIdx--;
			while (fileBuffer.charAt(resourceIdx) !== targetQuote) {
				resourceIdx--;
			}resourceName = fileBuffer.slice(resourceIdx + 1, quoteIdx);
		} else {
			// find the end of the word
			var endChars = ['\n', '\t', ',', '\r'];
			while (endChars.indexOf(fileBuffer.charAt(resourceIdx)) < 0 && resourceIdx > 0) {
				resourceIdx--;
			}resourceName = fileBuffer.slice(resourceIdx + 1, colonIdx);
		}

		// find the end of the resource defintion by searching for the end brace relative to this start brace
		var endIdx = startIdx + 1;
		openBraceCount = 0;
		while (fileBuffer.charAt(endIdx) !== '}' || openBraceCount !== 0) {
			if (fileBuffer.charAt(endIdx) === '{') openBraceCount++;else if (fileBuffer.charAt(endIdx) === '}') openBraceCount--;
			endIdx++;
		}
		// check if there is a comma separating the next resource
		if (fileBuffer.charAt(endIdx + 1) === ',') endIdx++;

		// parse the resource defintion to find 'resolution' property
		var resourceDefintion = fileBuffer.slice(startIdx, endIdx + 1);
		var resolutionIdx = resourceDefintion.indexOf('resolution');
		if (resolutionIdx >= 0) {
			while (isNaN(parseInt(resourceDefintion.charAt(resolutionIdx))) && resolutionIdx < endIdx) {
				if (resolutionIdx + 1 === endIdx) logFn(resolutionIdx + ' and ' + endIdx + ' a parsing error may have occurred'); // parsing error
				resolutionIdx++;
			}
			if (resolutionIdx === endIdx) resolution = DEFAULT_RESOLUTION;else resolution = parseInt(resourceDefintion.charAt(resolutionIdx));
		} else {
			resolution = DEFAULT_RESOLUTION;
			logFn('Resolution not found. Default: ' + DEFAULT_RESOLUTION + ' will be used');
		}

		var searchIdx = 0;

		if (styleSuffix !== undefined) {
			resourceName = resourceName + styleSuffix;
			logFn('Style suffix appended to resource: ' + resourceName + '. Theme will not be re-written');
		} else {
			var firstResource = fileBuffer.slice(0, resourceIdx);
			var secondResource = fileBuffer.slice(endIdx + 1);
			var commentedRes = '\n\t\t\t// replaced by spritesheet >>  ' + options.name + '_spritesheet\n\t\t\t/** "' + resourceName + '": ' + resourceDefintion + ' */';
			var updatedThemeBuffer = void 0;
			if (options.removeOldTheme) {
				updatedThemeBuffer = firstResource + secondResource;
			} else {
				updatedThemeBuffer = firstResource + commentedRes + secondResource;
				searchIdx = startIdx + commentedRes.length;
			}
			fileBuffer = updatedThemeBuffer;
			themeBuffers[pathToResource] = fileBuffer;
		}

		logFn('resourceName: ' + resourceName + ' resolution: ' + resolution);

		extractedResources.push({
			resourceName: resourceName,
			resolution: resolution
		});

		idx = fileBuffer.indexOf(resUrl, searchIdx);
	}
	return extractedResources;
}

function extractThemeInfo(filePath, options) {
	var hasTactileSuffix = false; // if true the url has _tactile and is not mapped to a specific resource
	var srcPath = _path2.default.resolve('./PixiArenas/');
	var results = runGrep(filePath, srcPath);
	if (results && results.stdout) {
		var out = results.stdout.toString();
		var splitResults = out.split(':\t'); // printed as location: 'fullstring'
		var foundPath = splitResults[0];
		var foundValidPath = foundPath && foundPath.length > 0;

		if (!foundValidPath) {
			hasTactileSuffix = filePath.indexOf(TACTILE_SUFFIX) >= 0;
			if (hasTactileSuffix) {
				logFn('No resource definition found for tactile resource: ' + filePath, true);
				var rootAsset = filePath.replace(TACTILE_SUFFIX, '');
				var findRootResults = runGrep(rootAsset, srcPath);
				if (findRootResults && findRootResults.stdout) {
					foundPath = results.stdout.toString().split(':\t')[0];
					foundValidPath = foundPath && foundPath.length > 0;
					filePath = rootAsset;
				}
			}
		}

		if (foundValidPath) {
			return parseResourceDef(foundPath, filePath, hasTactileSuffix ? TACTILE_SUFFIX : undefined, options);
		} else {
			logFn('Unable to resolve resource defintion for: ' + filePath, true);
		}
	}
	return;
}

function _cropFile(filePath) {
	var cropId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'outline';
	var ignoreCropDraw = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

	if (ignoreCropDraw) {
		var fileBuffer = _fs2.default.readFileSync(filePath, 'utf8');
		var hasElement = fileBuffer.indexOf(cropId) >= 0;
		if (!hasElement) return;
	}

	// CROP
	var inkscapeCmd = '';
	var fullPath = _path2.default.resolve(filePath);
	var plat = _os2.default.platform();
	if (plat === 'darwin') inkscapeCmd = '/Applications/Inkscape.app/Contents/Resources/bin/inkscape';else if (plat === 'linux') inkscapeCmd = 'inkscape';else if (plat === 'win32') inkscapeCmd = 'C:/Progra~1/Inkscape/inkscape.exe';else logFn('Not sure what OS you are running. Let us know if you get this error.', true);

	var cmdArgs = void 0;
	if (inkscapeCmd) {
		cmdArgs = [];
		cmdArgs.push('--select=' + cropId);
		cmdArgs.push('--verb=FitCanvasToSelectionOrDrawing');
		cmdArgs.push('--verb=FileSave');
		cmdArgs.push('--verb=FileQuit');
		cmdArgs.push('' + fullPath);
	}

	if (inkscapeCmd && cmdArgs) {
		_child_process2.default.spawnSync(inkscapeCmd, cmdArgs);
		var exportProcess = '--export-plain-svg="' + fullPath + '"';
		logFn('Crop image: ' + fullPath);
		_child_process2.default.spawnSync(inkscapeCmd, [fullPath, exportProcess]);
	}
}

function __getSizeOfFile(filePath, resolution) {
	var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

	// crop the file to a given crop id (defaults to 'outline')
	if (!options.ignoreCrop) _cropFile(filePath, options.cropId, options.ignoreCropDraw);
	var fullPath = _path2.default.resolve(filePath);
	// parse the file to generate SVGDOM and prepare for optimization
	var parser = new _xmldom.DOMParser();
	// read the file
	var fileBuffer = _fs2.default.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	var svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));
	logFn('Start SVG optimization');
	return __optimizeSVG(svgDom, fullPath, {}).then(function (result) {
		logFn('Complete SVG optimization');
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

		logFn('Parsed image size - w:' + viewBox.width + ' h:' + viewBox.height);

		var fileData = {};
		fileData.svgDOM = svgDom;
		fileData.width = viewBox.width;
		fileData.height = viewBox.height;
		fileData.area = viewBox.width * viewBox.height;
		fileData.processed = true;
		return fileData;
	});
}

function generatePNGjs(svgPath, pngName, pngPath, svgs, themeJSON, options) {
	var svgString = _fs2.default.readFileSync(svgPath);

	var _getSvgSize = getSvgSize(svgString),
	    width = _getSvgSize.width,
	    height = _getSvgSize.height;

	var targetName = pngPath;
	// parse info from svg and themeInfo toe generate a js class with required information to parse spritesheet
	var newTexturePackerDef = generateTexturePackerDef(svgs, targetName, width, height, themeJSON);
	var themeFileData = {
		url: '/' + targetName,
		metadata: {
			spriteSheetPng: newTexturePackerDef
		}
		// get the path for the js file and make the directory if needed
	};var savePath = _path2.default.resolve(options.spritesheetLoc);
	// create the path if not already there
	if (!_fs2.default.existsSync(savePath)) _fs2.default.mkdirSync(savePath);
	// define the path to the location of the js file
	savePath = _path2.default.resolve(options.spritesheetLoc, pngName + '.js');
	// write file to that path
	var prettyPrintLevel = 4;
	var jsonString = JSON.stringify(themeFileData, null, prettyPrintLevel);
	logFn('Write js file to: ' + savePath);
	_fs2.default.writeFileSync(savePath, "export default " + jsonString);
}

async function generatePNG(svgSprtSheetPath, pngPath, options) {
	var svgString = _fs2.default.readFileSync(svgSprtSheetPath);

	var _getSvgSize2 = getSvgSize(svgString),
	    width = _getSvgSize2.width,
	    height = _getSvgSize2.height;

	// get the absolute path


	var dataUrl = 'file:///' + _path2.default.resolve(svgSprtSheetPath);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width: width,
		height: height,
		toPath: pngPath
	}).then(function () {
		logFn('PNG image has been saved to: ' + pngPath);
		_fs2.default.unlinkSync(svgSprtSheetPath);
	});
}

async function saveImg(_ref) {
	var url = _ref.url,
	    width = _ref.width,
	    height = _ref.height,
	    toPath = _ref.toPath;

	var browser = await _puppeteer2.default.launch({ headless: true });
	var page = await browser.newPage();

	var _path$parse = _path2.default.parse(toPath),
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
			newTexturePackerDef.frames[key].originalUrl = '/' + assetInfo.url;
			if (assetInfo.metadata.resolution) {
				newTexturePackerDef.frames[key].resolution = assetInfo.metadata.resolution;
			}
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