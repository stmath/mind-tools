import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import child_process from 'child_process';
import os from 'os';
import {DOMParser, XMLSerializer} from 'xmldom';
import { run as sorterRun } from './utils/sorter';
import { pack} from './utils/packing';
import { default as Utils } from './utils/utils';
import { default as SVGO } from 'svgo';
import {getJsonFile, createPath, mkdir} from './common/file';

const ERROR_EXIT = 1;
const SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;

export async function convertSpritesheet (folderPath, options = {}) {
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

	let svgPromises = findAllSVGs(folderPath);
	Promise.all(svgPromises).then((values) => {
		let svgs = values;
		
		let name = 'Composite'

		console.log('Extracting outline paths')
		writeOutlinesToJSON(folderPath, name, svgs);

		options.algorithm = options.hasOwnProperty('algorithm') ? options.algorithm : 'growing-binpacking';
		options.sort = options.hasOwnProperty('sort') ? options.sort : 'maxside';
		options.square = true;
		console.log('Precalculating SVG spritesheet size');
		__determineCanvasSize(svgs, options);

		const outSvgName = path.resolve(folderPath, 'compositeSVG_spriteSheet.svg');
		console.log('Constructing packed SVG spritesheet');
		__generateImage(svgs, options, outSvgName)

		console.log('Generating JSON data for mapping frames to resources');
		let themeJSON = __generateJSON(svgs, folderPath, 'compositeSVG');

		console.log('Converting spritesheet from SVG to PNG');
		let pngName = createPath(folderPath, 'compositeSVG_spriteSheet.png');
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



function extractOutlineFromString (fileStr, id='outline') {
    let outlineIndex = fileStr.indexOf(`id="${id}"`);
    if (outlineIndex < 0) outlineIndex = fileStr.indexOf(`id='${id}'`);
    if (outlineIndex > 0) {
        // find the end of the element starting from the start of the outline id
        let endElement = fileStr.indexOf('/>', outlineIndex);
        let startElement = outlineIndex;
        // iterate backwards until we find the start of the element
        while (fileStr.charAt(startElement) !== '<') startElement--;
        // add all to a single line, and convert double quotes to single quotes
        let extractedPath = fileStr.slice(startElement, endElement + 1);
        let doubleQuote = /"/gi;
        let newline = /(\r\n|\n|\r)/gm
        extractedPath = extractedPath.replace(doubleQuote, "'");
        extractedPath = extractedPath.replace(newline, "");
        return extractedPath;
    }
    return null;
}

function openFileForOutlines (folderPath, file, relativeSrc = undefined, outlinesToSearch) {
	let resolvedPath = path.resolve(`${folderPath}/${file}`);
	let contents = fs.readFileSync(resolvedPath, {encoding: 'utf-8'});
	let extractedElements = [];

	for (let iter = 0; iter < outlinesToSearch.length; iter++) {
		let outlineId = outlinesToSearch[iter];
		// check for outline id in both single and double quotes
		let regexId = new RegExp(outlineId, "g"); 
		if (contents && regexId) {
			let allMatches = contents.match(regexId);
			if (allMatches) {
				for (let regexIter = 0; regexIter < allMatches.length; regexIter++) {
					let outlineId = allMatches[regexIter];
					let extractedPath = extractOutlineFromString(contents, outlineId); 
					if (extractedPath) {
						extractedElements.push({outlineId, extractedPath});
					}
				}
			}
		}
	}
	if (extractedElements.length > 0) {
		let name = (relativeSrc !== undefined) ? relativeSrc + '/' + file : folderPath + '/' + file;
		return {name: name, elements: extractedElements}
	}
	return undefined
}

function writeOutlinesToJSON (filePath, name, svgFiles, relativeDir) {
    let outlineJSONStr = '{'
    for (let iter = 0; iter < svgFiles.length; iter++) {
		let file = svgFiles[iter];
		if (file.outlineData === undefined) continue;

        let fileName = file.name;
        if (relativeDir !== undefined) {
            fileName = relativeDir + fileName;
        }
        outlineJSONStr += `\n"${fileName}": {\n`;
        for (let elemIter = 0; elemIter < file.elements.length; elemIter++) {
            let element = file.elements[elemIter];
            outlineJSONStr += `\t"${element.outlineId}": "${element.extractedPath}"`;
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

    let outlinePath = createPath(filePath, `${name}_Outlines.json`);
    fs.writeFileSync(outlinePath, outlineJSONStr);
}

function __optimizeSVG (data, pathName, options) {
	let prefix = true;

	let plugins = [
		{
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
			prefixIds: (Boolean(prefix) === true) ? {
				delim: '__',
				prefixIds: true,
				prefixClassNames: true
			} : false
		}
	];

	let svgoOpts = {
		plugins
	};

	const svgo = new SVGO(svgoOpts);
	return svgo.optimize(data, { path: pathName }).then(function (result) {
		let didChange = result !== data;
		if (didChange) {
			try {
				fs.writeFileSync(pathName, result.data, 'utf8');
			} catch (e) {
				console.error(e);
			}
		}
	});
}

function __generateJSON (svgs, folderPath, fileNameRoot) {
	let themeObj = {};
	const DEFAULT_RESOLUTION = 1;
	// let resToUse = (!isNaN(file.resolution)) ? file.resolution :(!isNaN(resolution)) ? resolution : DEFAULT_RESOLUTION,
	const shouldDefer = false;
	// for each svg we need to store the data in a way that's consumable by the sdk
	svgs.forEach((file) => {
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

function __generateImage (files, options, outSvgName) {
	const FIRST_INDEX = 0;
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
		let useStr = `<use xlink:href="#${symbolId}" transform="translate(${fileData.x}, ${fileData.y}) scale(${fileData.resolution} ${fileData.resolution})" />`;
		storedUseStrs.push(useStr);
		
	});

	let finalDocArr = [startSvgString].concat(storedSymbolsStrs).concat(storedUseStrs).concat([endSvgString]);
	let finalDocStr = `${finalDocArr.join(`
`)}`;

	options.svgDOMString = finalDocStr.replace(/\s\s+/, ' '); // optimize by removing newline spaces.
	console.log(outSvgName);
	fs.writeFileSync(outSvgName, finalDocStr);
};


function __determineCanvasSize (files, options) {
	const frameBuffer = 1;
	// add a frame buffer to the values passed into the padding
	// this will force the resulting svg to include the given padding between each frame
	// this value is currently used for both the x and y coordinates
	files.forEach(function (item) {
		item.w = item.width + frameBuffer;
		item.h = item.height + frameBuffer;

        if (isNaN(options.width)) options.width = item.width;
		else options.width += (item.width + frameBuffer);

		if (isNaN(options.height)) options.height = item.height;
		else options.height += (item.height + frameBuffer);
	});

	if (options.square) {
		options.width = options.height = Math.max(options.width, options.height);
	}

	if (options.powerOfTwo) {
		options.width = roundToPowerOfTwo(options.width);
		options.height = roundToPowerOfTwo(options.height);
	}

	// sort files based on the choosen options.sort method
	console.log('will sort')
	sorterRun(options.sort, files);
	console.log(`will pack width: ${options.width} height: ${options.height}`);
	pack(options.algorithm, files, options);
}

function roundToPowerOfTwo (value) {
	var powers = 2;
	while (value > powers) {
		powers *= 2;
	}

	return powers;
}

function findAllSVGs (folderPath) {
	let promises = [];
	let resolvedAssetDir = path.resolve(folderPath);
	let type = 'svg';
	let results = fs.readdirSync(resolvedAssetDir); // {withFileTypes: true} should return Dirent objects, but not on build
	// files will now be strings that represent the names of the file or folder
	let files = results.filter(file => file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0);
	files.forEach (function (file) {
		if (file.endsWith('_spriteSheet.svg')) {
			return;
		}
		let extractPromise = extractData(file, folderPath);
		promises.push(extractPromise);
	});
	
	let folders = results.filter(file => file.indexOf('.') < 0);
	folders.forEach(function (folder) {
		let nextFolder
		try {
			nextFolder = `${folderPath}/${folder}`;
			let nextSet = findAllSVGs(nextFolder);
			promises = promises.concat(nextSet);
		} catch (e) {
			console.log(`unable to open ${nextFolder}`);
		}
	});
	return promises;
}

async function extractData (file, folderPath) {
	const DEFAULT_RESOLUTION = 1;
	let filePath = `${folderPath}/${file}`;

	let outlineData = openFileForOutlines(folderPath, file, undefined, ['outline']);

	let resName = file.replace('.svg', '');
	let trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	// trimmedUrl = trimmedUrl.replace('../', '').replace('./', '') + outSvgName; todo this will need to reference the composite spritesheet
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;


	let srcPath = path.resolve('./PixiArenas/');

	const command = 'grep';
	let args = ['-F', '-R', filePath, srcPath];
	const spawn = child_process.spawnSync;
	let results = spawn(command, args);
	let resolution = DEFAULT_RESOLUTION;
	let resourceName = '';
	if (results && results.stdout) {
		let out = results.stdout.toString();
		let foundPath = out.split(':\t')[0];
		let fileBuffer = fs.readFileSync(foundPath, 'utf8');
		let idx = fileBuffer.indexOf(filePath);
		if (idx >= 0) {
			let startIdx = idx;
			let openBraceCount = 0;
			// TODO: use regex

			// find the open brace for this resource definition
			while (fileBuffer.charAt(startIdx) !== '{' || openBraceCount !== 0) {
				if (fileBuffer.charAt(startIdx) === '}') openBraceCount++;
				else if (fileBuffer.charAt(startIdx) === '{') openBraceCount--;
				startIdx--;
			}

			// find the name of the resource object based on the next property with quotes
			let resourceIdx = startIdx;
			let endQuoteIdx = -1;
			while (fileBuffer.charAt(resourceIdx) !== `'` || endQuoteIdx === -1) {
				if (fileBuffer.charAt(resourceIdx) === `'`) endQuoteIdx = resourceIdx;
				resourceIdx--;
			}
			resourceName = fileBuffer.slice(resourceIdx + 1, endQuoteIdx);

			// find the end of the resource defintion by searching for the end brace relative to this start brace
			let endIdx = startIdx + 1;
			openBraceCount = 0;
			while (fileBuffer.charAt(endIdx) !== '}' || openBraceCount !== 0) {
				if (fileBuffer.charAt(endIdx) === '{') openBraceCount++;
				else if (fileBuffer.charAt(endIdx) === '}') openBraceCount--;
				endIdx++;
			}

			let resourceDefintion = fileBuffer.slice(startIdx, endIdx + 1);

			let resolutionIdx = resourceDefintion.indexOf('resolution');
			if (resolutionIdx >= 0 ) {
				while(isNaN(parseInt(resourceDefintion.charAt(resolutionIdx)))) resolutionIdx++;
				resolution = parseInt(resourceDefintion.charAt(resolutionIdx));
			} else {
				resolution = 2;
			}
		}
		
	}
	
	return __getSizeOfFile(filePath, resolution).then((res) => {
		let svgData = res;
		svgData.name = resName;
		svgData.url = filePath;
		svgData.trimmedUrl = trimmedUrl;
		svgData.path = filePath;
		svgData.index = 'pending'
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

function __getSizeOfFile (filePath, resolution) {
	let parser = new DOMParser();
	// read the file
	let fileBuffer = fs.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	let svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

	let fullPath = path.resolve(filePath);
	return __optimizeSVG(svgDom, fullPath, {}).then(function (result) {
		fileBuffer = fs.readFileSync(filePath, 'utf8');
		// white spaces generate too many text elems, lets remove them before parsing to xmldom.
		svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

		// finding out the dimensions
		let viewBoxAttr = svgDom.documentElement.getAttribute('viewBox');
		if (!viewBoxAttr) viewBoxAttr = svgDom.documentElement.getAttribute('viewbox');
		let viewBox = {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};

		if (viewBoxAttr) {
			const viewBoxArr = viewBoxAttr.replace(/\s\s+/g, ' ').split(' ');
			const xIndex = 0;
			const yIndex = 1;
			const wIndex = 2;
			const hIndex = 3;
			viewBox.x = Number(viewBoxArr[xIndex]) * resolution;
			viewBox.y = Number(viewBoxArr[yIndex]) * resolution;
			viewBox.width = Number(viewBoxArr[wIndex]) * resolution;
			viewBox.height = Number(viewBoxArr[hIndex]) * resolution;
			// adjust based on resolution
			svgDom.documentElement.setAttribute('viewbox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
		} else {
			const DEFAULT_X = 0;
			const DEFAULT_Y = 0;
			const DEFAULT_WIDTH = 0;
			const DEFAULT_HEIGHT = 0;

			viewBox.x = Number(svgDom.documentElement.getAttribute('x').replace('px', '')) || DEFAULT_X;
			viewBox.y = Number(svgDom.documentElement.getAttribute('y').replace('px', '')) || DEFAULT_Y;
			viewBox.width = Number(svgDom.documentElement.getAttribute('width').replace('px', '')) || DEFAULT_WIDTH;
			viewBox.height = Number(svgDom.documentElement.getAttribute('height').replace('px', '')) || DEFAULT_HEIGHT;
		}

		let fileData = {};
		fileData.svgDOM = svgDom;
		fileData.width = viewBox.width;
		fileData.height = viewBox.height;
		fileData.area = viewBox.width * viewBox.height;
		fileData.processed = true;
		return fileData;
	});
}

export async function generatePNG (svgSprtSheetPath, pngSpritesheetName, svgs, themeJSON) {
	svgSprtSheetPath = path.posix.join(svgSprtSheetPath);
	let svgString = fs.readFileSync(svgSprtSheetPath);
	let {width, height} = getSvgSize(svgString);
	// get the absolute path
	let dataUrl = 'file:///' + path.resolve(svgSprtSheetPath);

	let pathParsed = path.parse(svgSprtSheetPath);
	let newSpriteSheetURL = path.posix.join(pathParsed.dir, pathParsed.name + '.png');
	let targetName = pathParsed.name + '.png'
	let newTexturePackerDef = generateTexturePackerDef(svgs, targetName, width, height, themeJSON);
	let themeFileData = {
		url: pngSpritesheetName,
		metadata: {
			spriteSheetPng: newTexturePackerDef
		}
	}
	let savePath = path.posix.join(path.parse(svgSprtSheetPath).dir, path.parse(svgSprtSheetPath).name);
	console.log(savePath);

	const prettyPrintLevel = 4;
	let jsonString = JSON.stringify(themeFileData, null, prettyPrintLevel);
	fs.writeFileSync(savePath + ".json", jsonString);
	fs.writeFileSync(savePath + ".js", "export default " + jsonString);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width,
		height,
		fromPath: svgSprtSheetPath
	}).then(() => {
		console.log('PNG image has been saved from: ' + svgSprtSheetPath);
		fs.unlinkSync(svgSprtSheetPath);
	})
}

async function saveImg({url, width, height, fromPath}) {
	let browser = await puppeteer.launch({ headless: true });
	let page = await browser.newPage();
	let {name, dir} = path.parse(fromPath);
	await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
	await page.setViewport({ width: width || 0, height: height || 0 });
	await page.screenshot({
		path: path.posix.join(dir, name + '.png'),
		type: "png",
		fullPage: true,
		omitBackground: true
	});
	await page.close();
	await browser.close();
}

const generateTexturePackerDef = (svgs, newSpriteSheetURL, width, height, themeJSON) => {
	let newTexturePackerDef = {
		frames: {},
		meta: {}
	};
	let isFirst = false;
	let keys = Object.keys(themeJSON);
	for (let prop of keys) {
		let key = prop;
		let assetInfo = themeJSON[prop];
		if (!isFirst) {
			newTexturePackerDef.meta = {
				app: "http://www.codeandweb.com/texturepacker",
				version: "1.0",
				image: newSpriteSheetURL,
				format: "RGBA8888",
				size: {"w": width,"h": height},
				scale: "1"
			};
			isFirst = true;
		}

		let frameInfo = assetInfo.metadata.spriteSheetSvg.frame;
		newTexturePackerDef.frames[key] = generateFrameInfo(frameInfo, newSpriteSheetURL);
		newTexturePackerDef.frames[key].originalUrl = assetInfo.url;
		if (assetInfo.metadata.resolution) newTexturePackerDef.frames[key].resolution;
	}
	return newTexturePackerDef;
}

const generateFrameInfo = (frameInfo, newSpriteSheetURL) => {
	return {
		"url": newSpriteSheetURL,
		"frame": {
			"x": frameInfo.x,
			"y": frameInfo.y,
			"w": frameInfo.width,
			"h": frameInfo.height,
		}, // {"x":912,"y":0,"w":304,"h":372},
		"rotated": false,
		"trimmed": false,
		"spriteSourceSize": {"x":0,"y":0,"w": frameInfo.width,"h": frameInfo.height},
		"sourceSize": {"w": frameInfo.width,"h": frameInfo.height}
	};
}

const getSvgSize = (svgString) => {
	const sizeMatch = SVG_SIZE.exec(svgString);
	const size = {};
	if (sizeMatch)
	{
		size[sizeMatch[1]] = Math.round(parseFloat(sizeMatch[3]));
		size[sizeMatch[5]] = Math.round(parseFloat(sizeMatch[7]));
	}
	return size;
}
