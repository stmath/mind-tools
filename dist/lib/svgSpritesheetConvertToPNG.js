'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.convertSpritesheet = convertSpritesheet;
exports.wrapperFunction = wrapperFunction;
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ERROR_EXIT = 1;
var SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;

function convertSpritesheet(folderPath) {
	var svgs = findAllSVGs(folderPath);
	svgs.forEach(function (res) {
		console.log(res.name);
	});
}

function findAllSVGs(folderPath) {
	var cleanSVGs = [];
	var resolvedAssetDir = _path2.default.resolve(folderPath);
	var type = 'svg';
	var results = _fs2.default.readdirSync(resolvedAssetDir); // {withFileTypes: true} should return Dirent objects, but not on build
	// files will now be strings that represent the names of the file or folder
	var files = results.filter(function (file) {
		return file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0;
	});
	files.forEach(function (file) {
		cleanSVGs.push(extractData(file, folderPath));
	});

	var folders = results.filter(function (file) {
		return file.indexOf('.') < 0;
	});
	folders.forEach(function (folder) {
		var nextFolder = void 0;
		try {
			nextFolder = folderPath + '/' + folder;
			cleanSVGs = cleanSVGs.concat(findAllSVGs(nextFolder));
		} catch (e) {
			console.log('unable to open ' + nextFolder);
		}
	});
	return cleanSVGs;
}

var extractData = function extractData(file, folderPath) {
	var filePath = folderPath + '/' + file;
	var resName = file.replace('.svg', '');
	var trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	// trimmedUrl = trimmedUrl.replace('../', '').replace('./', '') + outSvgName; todo this will need to reference the composite spritesheet
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;

	console.log('get size of: ' + resName);
	var svgData = __getSizeOfFile(filePath);
	svgData.name = resName;
	svgData.url = filePath;
	svgData.trimmedUrl = trimmedUrl;
	svgData.path = filePath;
	svgData.index = 'pending';
	svgData.extension = 'svg';
	// including info from starterkit


	// find instances of the given file in the src folder (searching for theme definition)
	var srcPath = _path2.default.resolve('./PixiArenas/*');
	var args = ['/S', '/M', '/C:"' + filePath + '"', srcPath];
	var command = _os2.default.platform() === 'win32' ? 'findStr' : 'grep'; // todo will need to check grep command
	var spawn = _child_process2.default.spawnSync;
	console.log(command + ' ' + args.join(' '));
	var results = spawn(command, args);
	if (results && results.output[1]) {
		var out = results.output[1];
		console.log('1:' + results.output[1]);
		// TODO: extract resolution from file
		svgData.resolution = 2;
	}

	return svgData;
};

var __getSizeOfFile = function __getSizeOfFile(filePath) {
	var parser = new _xmldom.DOMParser();
	// read the file
	var fileBuffer = _fs2.default.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	var svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

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
		viewBox.x = Number(viewBoxArr[xIndex]);
		viewBox.y = Number(viewBoxArr[yIndex]);
		viewBox.width = Number(viewBoxArr[wIndex]);
		viewBox.height = Number(viewBoxArr[hIndex]);
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
	return fileData;
};

function wrapperFunction(spritesheetPath) {
	generatePNG(spritesheetPath);
	console.log('test');
}

async function generatePNG(svgSprtSheetPath) {
	var jsonDefPath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

	console.log(svgSprtSheetPath);
	svgSprtSheetPath = _path2.default.posix.join(svgSprtSheetPath);
	console.log(svgSprtSheetPath);
	var svgString = _fs2.default.readFileSync(svgSprtSheetPath);

	var _getSvgSize = getSvgSize(svgString),
	    width = _getSvgSize.width,
	    height = _getSvgSize.height;
	// get the absolute path


	var dataUrl = 'file:///' + _path2.default.resolve(svgSprtSheetPath);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width: width,
		height: height,
		fromPath: svgSprtSheetPath
	});

	if (jsonDefPath) {
		jsonDefPath = _path2.default.posix.join(jsonDefPath);

		var jsonDef = void 0;
		var pathParsed = _path2.default.parse(jsonDefPath);
		var extensionOfFile = pathParsed.ext;
		var newSpriteSheetURL = _path2.default.posix.join(pathParsed.dir, pathParsed.name + '_png.png');
		newSpriteSheetURL = newSpriteSheetURL.startsWith('/') ? newSpriteSheetURL : '/' + newSpriteSheetURL;
		if (extensionOfFile === '.json') {
			jsonDef = JSON.parse(_fs2.default.readFileSync(jsonDefPath, { encoding: "utf8" }));
		} else if (extensionOfFile === '.js') {
			console.log('waiting');
			// jsonDef = (await jspmImport(jsonDefPath)).default;
		}
		console.log(newSpriteSheetURL);

		var newTexturePackerDef = generateTexturePackerDef(jsonDef, newSpriteSheetURL, width, height);

		var themeFileData = {
			url: newSpriteSheetURL,
			metadata: {
				spriteSheetPng: newTexturePackerDef
			}
		};
		var savePath = _path2.default.posix.join(_path2.default.parse(jsonDefPath).dir, _path2.default.parse(jsonDefPath).name + "_png");
		var jsonString = JSON.stringify(themeFileData);
		_fs2.default.writeFileSync(savePath + ".json", jsonString);
		_fs2.default.writeFileSync(savePath + ".js", "export default " + jsonString);
		console.log('end write');
	}
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
		path: _path2.default.posix.join(dir, name + '_png.png'),
		type: "png",
		fullPage: true,
		omitBackground: true
	});
	await page.close();
	await browser.close();
}

var generateTexturePackerDef = function generateTexturePackerDef(jsonDef, newSpriteSheetURL, width, height) {
	var keys = Object.keys(jsonDef);
	var newTexturePackerDef = {
		frames: {},
		meta: {}
	};
	var isFirst = false;
	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var prop = _step.value;

			var key = prop + "_png";
			var assetInfo = jsonDef[prop];
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
			newTexturePackerDef.frames[key] = generateFrameInfo(frameInfo);
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

var generateFrameInfo = function generateFrameInfo(frameInfo) {
	return {
		// "url": newSpriteSheetURL,
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