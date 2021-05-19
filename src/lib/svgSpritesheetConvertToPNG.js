import fs, { linkSync } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import child_process from 'child_process';
import {DOMParser, XMLSerializer} from 'xmldom';
import { run as sorterRun } from './utils/sorter';
import { pack} from './utils/packing';
import { default as Utils } from './utils/utils';
import { default as SVGO } from 'svgo';
import {createPath} from './common/file';
import os from 'os';

const ERROR_EXIT = 1;
const SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;
const DEFAULT_RESOLUTION = 1;
const TACTILE_SUFFIX = '_tactile';

var themeBuffers = {};
var DEBUG_ENABLED = false;

export async function convertSpritesheet (folderPath, name, options = {}) {
	// Unique steps for this automated conversion:
	// 1: Extract outlines from all svg resources
	// 2: Crop all svg resources
	// 3: Optimize all svg resources (ensure this doesn't break step 1)
	// 4: Generate a PNG spritesheet from SVG resources
	DEBUG_ENABLED = options.debugEnabled;

	let svgPromises = findAllSVGs(folderPath, options);
	Promise.all(svgPromises).then((values) => {
		let svgs = [];
		// clean away any undefined properties in values;
		for (let svgIter = 0; svgIter < values.length; svgIter++) {
			if (values[svgIter] != undefined) {
				svgs.push(...values[svgIter]);
			}
		}

		// all opened buffers for theme objects should be saved
		if (options.rewriteTheme) {
			let keys = Object.keys(themeBuffers);
			for (let iter = 0; iter < keys.length; iter++) {
				let filePath = keys[iter];
				logFn('Rewriting theme file: ' + filePath);
				fs.writeFileSync(filePath, themeBuffers[filePath], 'utf8');
			}
		}
		
		logFn('Extracting outline paths')
		let {relativeOutlinePath, hasOutlineElements} = writeOutlinesToJSON(folderPath, name, svgs);

		options.algorithm = options.hasOwnProperty('algorithm') ? options.algorithm : 'growing-binpacking';
		options.sort = options.hasOwnProperty('sort') ? options.sort : 'maxside';
		options.square = true;
		logFn('Precalculating SVG spritesheet size');
		__determineCanvasSize(svgs, options);

		const outSvgPath = path.resolve(folderPath, `${name}_spriteSheet.svg`);
		logFn('Constructing packed SVG spritesheet');
		__generateSVGSpritesheet(svgs, options, outSvgPath)

		logFn('Generating JSON data for mapping frames to resources');
		let themeJSON = __generateJSON(svgs);

		if (options.removeSVGs) {
			logFn('Remove SVG files added to spritesheet')
			let parsedSVGs = Object.keys(svgs);
			for (let iter = 0; iter < parsedSVGs.length; iter++) {
				let svgData = svgs[parsedSVGs[iter]];
				let pathToRemove = path.resolve(svgData.url);
				// validate file existence then remove
				if (fs.existsSync(pathToRemove)) fs.unlinkSync(pathToRemove);
			}					
		}

		logFn('Converting spritesheet from SVG to PNG');
		let pngName = `${name}_spriteSheet`
		let pngPath = createPath(folderPath, pngName + '.png');
		// generate and save the js class that stores frame info for spritesheets
		generatePNGjs(outSvgPath, pngName, pngPath, svgs, themeJSON, options)
		// include imports for the png js file into the game theme
		writeThemeImport(pngName, hasOutlineElements, relativeOutlinePath, options);
		// convert the generated svg spritesheet into a png spritesheet
		generatePNG(outSvgPath, pngPath);
	});
}

function logFn (str, force = false) {
	if (DEBUG_ENABLED || force) {
		console.log(str);
	}
}

function writeThemeImport (name, hasOutlineElements, relativeOutlinePath, options) {
	let gameName = options.gameName;
	let rootSrc = `PixiArenas/${gameName}`;
	// by convention main theme files should:
	// 1) be located at the top of the game specific directory PixiArenas/GameName
	// 2) be named with the game name followed by Theme.js
	// 3) include a export for gameStyles
	let gameThemePath = path.resolve(`${rootSrc}/${gameName}Theme.js`);
	let readBuffer = fs.readFileSync(gameThemePath);
	let importidx = readBuffer.lastIndexOf('import');
	let endImports = readBuffer.indexOf('\n', importidx);
	if (importidx > 0 && endImports > 0) {
		// write the import line for the spritesheet
		let relativeSpritesheet = `.${options.spritesheetLoc.split(rootSrc)[1]}`;
		let importString = `\nimport { default as ${name}Data } from '${relativeSpritesheet}/${name}.js';\n`
		readBuffer = readBuffer.slice(0, endImports) + importString + readBuffer.slice(endImports+1);
	} else {
		logFn('unable to resolve location for import of spritesheet data', true);
		return;
	}

	let gameStyleIdx = readBuffer.indexOf('gameStyles');
	if (gameStyleIdx >= 0) {
		// write the import for the spritesheet data at the top of the gameStyles object
		let styleIdx = readBuffer.indexOf('\n', gameStyleIdx);
		let includeStyle = `\n\t${name}: ${name}Data,\n`;

		if (hasOutlineElements) {
			includeStyle += `\t${name}Outlines: {\n\t\turl: '${relativeOutlinePath}',\n\t\tmetadata: {\n\t\t\tisOutline: ${true}\n\t\t}\n\t},\n`
		}

		readBuffer = readBuffer.slice(0, styleIdx) + includeStyle + readBuffer.slice(styleIdx+1);
	} else {
		logFn('Unable to resolve location for spritesheet theme in the game styles', true);
		return;
	}

	// overwrite theme data with updated file
	logFn('Add spritesheet import to: ' + gameThemePath);
	fs.writeFileSync(gameThemePath, readBuffer);
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
		name = '/' + name;
		return {name: name, elements: extractedElements};
	}
	return undefined
}

function writeOutlinesToJSON (filePath, name, svgFiles, relativeDir) {
	let outlineJSONStr = '{'
	let initialJSON = true;
	let hasOutlineElements = false;
    for (let iter = 0; iter < svgFiles.length; iter++) {
		let file = svgFiles[iter];
		if (!file || file.outline === undefined) continue;

        let fileName = file.outline.name;
        if (relativeDir !== undefined) {
            fileName = relativeDir + fileName;
		}
		
		// 
		if (!initialJSON) outlineJSONStr += ','
		if (initialJSON) initialJSON = false;

		outlineJSONStr += `\n"${fileName}": {\n`;
		let elements = file.outline.elements;
        for (let elemIter = 0; elemIter < elements.length; elemIter++) {
			hasOutlineElements = true;
            let element = elements[elemIter];
            outlineJSONStr += `\t"${element.outlineId}": "${element.extractedPath}"`;
            if (elemIter + 1 < elements.length) {
                outlineJSONStr += ',\n';
            } else {
                outlineJSONStr += '\n\t}';
            }
        }
    }
    outlineJSONStr += '\n}';

	let relativePath = createPath(filePath, `${name}_Outlines.json`);
	if (hasOutlineElements) {
		let resolvedPath = path.resolve(relativePath)
		fs.writeFileSync(resolvedPath, outlineJSONStr);
		logFn('Write outlines to: ' + resolvedPath);
	} else {
		logFn('Skip Outlines.json - no outline elements found', true);
		logFn('DEBUG - file will be written anyway');
		hasOutlineElements = true;
		let resolvedPath = path.resolve(relativePath)
		fs.writeFileSync(resolvedPath, outlineJSONStr);
	}
	// TODO:
	// Return info regaring the outline path if written.
	return {relativeOutlinePath: relativePath, hasOutlineElements};
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

function __generateJSON (svgs) {
	let themeObj = {};
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

		if (shouldDefer) {
			themeObj[file.name].metadata.defer = true;
			themeObj[file.name].defer = true;
		}
	});

	return themeObj;
}

function __generateSVGSpritesheet (files, options, outSvgName) {
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
		let symbolId = `---SYMBOL---${fileData.url}_${fileData.name}`;
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
	sorterRun(options.sort, files);
	pack(options.algorithm, files, options);
}

function roundToPowerOfTwo (value) {
	var powers = 2;
	while (value > powers) {
		powers *= 2;
	}

	return powers;
}

function findAllSVGs (folderPath, options) {
	let promises = [];
	let resolvedAssetDir = path.resolve(folderPath);
	let type = 'svg';
	// find all directory elements within the given directory
	let results = fs.readdirSync(resolvedAssetDir);
	// files will now be strings that represent the names of the file or folder
	let files = results.filter(file => file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0);
	files.forEach (function (file) {
		// ignore any _spriteSheet files
		if (file.endsWith('_spriteSheet.svg') || file.endsWith('_spriteSheet.png')) return;
		// extract data from the given file
		let extractPromise = extractData(file, folderPath, options);
		if (extractPromise) promises.push(extractPromise);
	});
	// iterate over all folders in the directory to find more files
	let folders = results.filter(file => file.indexOf('.') < 0);
	folders.forEach(function (folder) {
		let nextFolder
		try {
			// find all sub files in the folder and manage promises from extract data
			promises = promises.concat(findAllSVGs(`${folderPath}/${folder}`, options));
		} catch (e) {
			logFn(`unable to open ${nextFolder}`, true);
		}
	});
	return promises;
}

async function extractData (file, folderPath, options) {
	let filePath = `${folderPath}/${file}`;
	logFn('Parse file: ' + filePath);
	let resName = file.replace('.svg', '');
	// trim the url to remove any relative directory information
	let trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;
	// extract outline elements from this svg file, given the set of options 
	let outlineData = openFileForOutlines(folderPath, file, undefined, options.outlineIds);
	// extract expected resolution and resourceName from arena's theme definitions
	let extractedData = extractThemeInfo(filePath, options);
	if (!extractedData) {
		logFn(`Resource not found in theme: ${filePath}`, true);
		return;
	}
	
	// the first instance of the extracted data will define the resolution for the resource
	// this may need to be reoncisdered to either, use the max resolution or create separate svg instances for each unique resolution
	let resolution = extractedData[0].resolution;

	// parse the file to determine the expected dimensions of the rasterized SVG
	return __getSizeOfFile(filePath, resolution, options).then((res) => {
		let svgData = [];
		for (let iter = 0; iter < extractedData.length; iter++) {
			let svgDatum = Object.assign({}, res);
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

function runGrep (searchString, searchPath) {
	const command = 'grep';
	let args = ['-F', '-R', searchString, searchPath];
	const spawn = child_process.spawnSync;
	return spawn(command, args);
}

function parseResourceDef (pathToResource, resUrl, styleSuffix = undefined, options) {
	let resolution = DEFAULT_RESOLUTION;		// resolution defined by the resource
	let resourceName = '';						// id for the resource found in the theme file
	let extractedResources = [];
	let fileBuffer = themeBuffers[pathToResource];
	if (!fileBuffer) fileBuffer = fs.readFileSync(pathToResource, 'utf8');
	let idx = fileBuffer.indexOf(resUrl);
	while (idx >= 0) {
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
		while (fileBuffer.charAt(resourceIdx) !== ':') resourceIdx--;
		let colonIdx = resourceIdx;
		resourceIdx--;
		if (fileBuffer.charAt(resourceIdx) === `'` || fileBuffer.charAt(resourceIdx) === `"`) {
			// find closing quote:
			let targetQuote = fileBuffer.charAt(resourceIdx);
			let quoteIdx = resourceIdx;
			resourceIdx--;
			while (fileBuffer.charAt(resourceIdx) !== targetQuote) resourceIdx--;

			resourceName = fileBuffer.slice(resourceIdx + 1, quoteIdx);
		} else {
			// find the end of the word
			let endChars = ['\n', '\t', ',', '\r'];
			while(endChars.indexOf(fileBuffer.charAt(resourceIdx)) < 0 && resourceIdx > 0) resourceIdx--;
			resourceName = fileBuffer.slice(resourceIdx + 1, colonIdx);
		}

		// find the end of the resource defintion by searching for the end brace relative to this start brace
		let endIdx = startIdx + 1;
		openBraceCount = 0;
		while (fileBuffer.charAt(endIdx) !== '}' || openBraceCount !== 0) {
			if (fileBuffer.charAt(endIdx) === '{') openBraceCount++;
			else if (fileBuffer.charAt(endIdx) === '}') openBraceCount--;
			endIdx++;
		}
		// check if there is a comma separating the next resource
		if (fileBuffer.charAt(endIdx + 1) === ',') endIdx++;

		// parse the resource defintion to find 'resolution' property
		let resourceDefintion = fileBuffer.slice(startIdx, endIdx + 1);
		let resolutionIdx = resourceDefintion.indexOf('resolution');
		if (resolutionIdx >= 0 ) {
			while(isNaN(parseInt(resourceDefintion.charAt(resolutionIdx))) && resolutionIdx < endIdx) {
				if (resolutionIdx + 1 === endIdx) logFn(resolutionIdx + ' and ' + endIdx + ' a parsing error may have occurred'); // parsing error
				resolutionIdx++;
			} 
			if (resolutionIdx === endIdx) resolution = DEFAULT_RESOLUTION;
			else resolution = parseInt(resourceDefintion.charAt(resolutionIdx));
		} else {
			resolution = DEFAULT_RESOLUTION;
			logFn(`Resolution not found. Default: ${DEFAULT_RESOLUTION} will be used`);
		}

		let searchIdx = 0;

		if (styleSuffix !== undefined) {
			resourceName = resourceName + styleSuffix;
			logFn(`Style suffix appended to resource: ${resourceName}. Theme will not be re-written`);
		} else {
			let firstResource = fileBuffer.slice(0, resourceIdx);
			let secondResource = fileBuffer.slice(endIdx + 1);
			let commentedRes = `
			// replaced by spritesheet >>  ${options.name}_spritesheet
			/** ${resourceDefintion} */`;
			let updatedThemeBuffer;
			if (options.removeOldTheme) {
				updatedThemeBuffer = firstResource + secondResource;
			}
			else {
				updatedThemeBuffer = firstResource + commentedRes + secondResource;
				searchIdx = startIdx + commentedRes.length;
			}
			fileBuffer = updatedThemeBuffer;
			themeBuffers[pathToResource] = fileBuffer;
		}
		
		logFn(`resourceName: ${resourceName} resolution: ${resolution}`);

		extractedResources.push({
			resourceName,
			resolution
		})

		idx = fileBuffer.indexOf(resUrl, searchIdx);
	}
	return extractedResources;
}

function extractThemeInfo (filePath, options) {
	let hasTactileSuffix = false;				// if true the url has _tactile and is not mapped to a specific resource
	let srcPath = path.resolve('./PixiArenas/');
	let results = runGrep(filePath, srcPath);
	if (results && results.stdout) {
		let out = results.stdout.toString();
		let splitResults = out.split(':\t') // printed as location: 'fullstring'
		let foundPath = splitResults[0];
		let foundValidPath = foundPath && foundPath.length > 0;

		if (!foundValidPath) {
			hasTactileSuffix = filePath.indexOf(TACTILE_SUFFIX) >= 0;
			if (hasTactileSuffix) {
				logFn(`No resource definition found for tactile resource: ${filePath}`, true)
				let rootAsset = filePath.replace(TACTILE_SUFFIX, '');
				let findRootResults = runGrep(rootAsset, srcPath);
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
			logFn(`Unable to resolve resource defintion for: ${filePath}`, true);
		}
	}
	return;
}

function _cropFile (filePath, cropId = 'outline', ignoreCropDraw = false) {
	if (ignoreCropDraw) {
		let fileBuffer = fs.readFileSync(filePath, 'utf8');
		let hasElement = fileBuffer.indexOf(cropId) >= 0;
		if (!hasElement) return;
	}

	// CROP
	let inkscapeCmd = '';
	let fullPath = path.resolve(filePath);
	let plat = os.platform();
	if (plat === 'darwin') inkscapeCmd = '/Applications/Inkscape.app/Contents/Resources/bin/inkscape';
	else if (plat === 'linux') inkscapeCmd = 'inkscape';
	else if (plat === 'win32') inkscapeCmd = 'C:/Progra~1/Inkscape/inkscape.exe';
	else logFn('Not sure what OS you are running. Let us know if you get this error.', true);

	let cmdArgs;
	if (inkscapeCmd) {
		cmdArgs = []
		cmdArgs.push(`--select=${cropId}`);
		cmdArgs.push(`--verb=FitCanvasToSelectionOrDrawing`);
		cmdArgs.push(`--verb=FileSave`);
		cmdArgs.push(`--verb=FileQuit`);
		cmdArgs.push(`${fullPath}`);
	}

	if (inkscapeCmd && cmdArgs) {
		child_process.spawnSync(inkscapeCmd, cmdArgs);
		let exportProcess = `--export-plain-svg="${fullPath}"`
		logFn(`Crop image: ${fullPath}`);
		child_process.spawnSync(inkscapeCmd, [fullPath, exportProcess]);
	}
}


function __getSizeOfFile (filePath, resolution, options = {}) {
	// crop the file to a given crop id (defaults to 'outline')
	if (!options.ignoreCrop) _cropFile(filePath, options.cropId, options.ignoreCropDraw);
	let fullPath = path.resolve(filePath);
	// parse the file to generate SVGDOM and prepare for optimization
	let parser = new DOMParser();
	// read the file
	let fileBuffer = fs.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	let svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));
	logFn('Start SVG optimization');
	return __optimizeSVG(svgDom, fullPath, {}).then(function (result) {
		logFn('Complete SVG optimization');
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

		logFn(`Parsed image size - w:${viewBox.width} h:${viewBox.height}`);

		let fileData = {};
		fileData.svgDOM = svgDom;
		fileData.width = viewBox.width;
		fileData.height = viewBox.height;
		fileData.area = viewBox.width * viewBox.height;
		fileData.processed = true;
		return fileData;
	});
}

function generatePNGjs (svgPath, pngName, pngPath, svgs, themeJSON, options) {
	let svgString = fs.readFileSync(svgPath);
	let {width, height} = getSvgSize(svgString);
	let targetName = pngPath;
	// parse info from svg and themeInfo toe generate a js class with required information to parse spritesheet
	let newTexturePackerDef = generateTexturePackerDef(svgs, targetName, width, height, themeJSON);
	let themeFileData = {
		url: '/' + targetName,
		metadata: {
			spriteSheetPng: newTexturePackerDef
		}
	}
	// get the path for the js file and make the directory if needed
	let savePath = path.resolve(options.spritesheetLoc);
	// create the path if not already there
	if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);
	// define the path to the location of the js file
	savePath = path.resolve(options.spritesheetLoc, pngName + '.js');
	// write file to that path
	const prettyPrintLevel = 4;
	let jsonString = JSON.stringify(themeFileData, null, prettyPrintLevel);
	logFn(`Write js file to: ${savePath}`);
	fs.writeFileSync(savePath, "export default " + jsonString);
}

export async function generatePNG (svgSprtSheetPath, pngPath, options) {
	let svgString = fs.readFileSync(svgSprtSheetPath);
	let {width, height} = getSvgSize(svgString);

	// get the absolute path
	let dataUrl = 'file:///' + path.resolve(svgSprtSheetPath);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width,
		height,
		toPath: pngPath
	}).then(() => {
		logFn(`PNG image has been saved to: ${pngPath}`);
		fs.unlinkSync(svgSprtSheetPath);
	})
}

async function saveImg({url, width, height, toPath}) {
	let browser = await puppeteer.launch({ headless: true });
	let page = await browser.newPage();
	let {name, dir} = path.parse(toPath);
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
		newTexturePackerDef.frames[key].originalUrl = '/' + assetInfo.url;
		if (assetInfo.metadata.resolution) {
			newTexturePackerDef.frames[key].resolution = assetInfo.metadata.resolution;
		}
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
