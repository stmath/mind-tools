import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import child_process from 'child_process';
import os from 'os';
import {DOMParser} from 'xmldom';

const ERROR_EXIT = 1;
const SVG_SIZE = /<svg[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*(?:\s(width|height)=('|")(\d*(?:\.\d+)?)(?:px)?('|"))[^>]*>/i;

export function convertSpritesheet (folderPath) {
	let svgs = findAllSVGs(folderPath);
	svgs.forEach (function (res) {
		console.log(res.name);
	});
}

function findAllSVGs (folderPath) {
	let cleanSVGs = [];
	let resolvedAssetDir = path.resolve(folderPath);
	let type = 'svg';
	let results = fs.readdirSync(resolvedAssetDir); // {withFileTypes: true} should return Dirent objects, but not on build
	// files will now be strings that represent the names of the file or folder
	let files = results.filter(file => file.indexOf('.') >= 0 && file.indexOf('.' + type) >= 0);
	files.forEach (function (file) {
		cleanSVGs.push(extractData(file, folderPath));
	});
	
	let folders = results.filter(file => file.indexOf('.') < 0);
	folders.forEach(function (folder) {
		let nextFolder
		try {
			nextFolder = `${folderPath}/${folder}`
			cleanSVGs = cleanSVGs.concat(findAllSVGs(nextFolder));
		} catch (e) {
			console.log(`unable to open ${nextFolder}`);
		}
	});
	return cleanSVGs;
}

const extractData = (file, folderPath, ) => {
	let filePath = `${folderPath}/${file}`;
	let resName = file.replace('.svg', '');
	let trimmedUrl = filePath;
	if (trimmedUrl.startsWith('./')) trimmedUrl = trimmedUrl.replace('./', '');
	if (trimmedUrl.startsWith('../')) trimmedUrl = trimmedUrl.replace('../', '');
	// trimmedUrl = trimmedUrl.replace('../', '').replace('./', '') + outSvgName; todo this will need to reference the composite spritesheet
	if (!trimmedUrl.startsWith('/')) trimmedUrl = '/' + trimmedUrl;

	console.log(`get size of: ${resName}`);
	let svgData = __getSizeOfFile(filePath);
	svgData.name = resName;
	svgData.url = filePath;
	svgData.trimmedUrl = trimmedUrl;
	svgData.path = filePath;
	svgData.index = 'pending'
	svgData.extension = 'svg';
	// including info from starterkit


	// find instances of the given file in the src folder (searching for theme definition)
	let srcPath = path.resolve('./PixiArenas/*');
	let args = ['/S', '/M', `/C:"${filePath}"`, srcPath];
	const command = (os.platform() === 'win32') ? 'findStr' : 'grep'; // todo will need to check grep command
	const spawn = child_process.spawnSync;
	console.log(`${command} ${args.join(' ')}`);
	let results = spawn(command, args );
	if (results && results.output[1]) {
		let out = results.output[1];
		console.log('1:' + results.output[1]);
		// TODO: extract resolution from file
		svgData.resolution = 2;
	}

	return svgData
}

const __getSizeOfFile = (filePath) => {
	let parser = new DOMParser();
	// read the file
	const fileBuffer = fs.readFileSync(filePath, 'utf8');
	// white spaces generate too many text elems, lets remove them before parsing to xmldom.
	const svgDom = parser.parseFromString(fileBuffer.replace(/\s\s+/g, ' '));

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
		viewBox.x = Number(viewBoxArr[xIndex]);
		viewBox.y = Number(viewBoxArr[yIndex]);
		viewBox.width = Number(viewBoxArr[wIndex]);
		viewBox.height = Number(viewBoxArr[hIndex]);
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
	return fileData;
}


export function wrapperFunction (spritesheetPath) {
	generatePNG(spritesheetPath);
	console.log('test');
}

export async function generatePNG (svgSprtSheetPath, jsonDefPath = undefined) {
	console.log(svgSprtSheetPath);
	svgSprtSheetPath = path.posix.join(svgSprtSheetPath);
	console.log(svgSprtSheetPath);
	let svgString = fs.readFileSync(svgSprtSheetPath);
	let {width, height} = getSvgSize(svgString);
	// get the absolute path
	let dataUrl = 'file:///' + path.resolve(svgSprtSheetPath);

	// async saveImg
	await saveImg({
		url: dataUrl,
		width,
		height,
		fromPath: svgSprtSheetPath
	});

	if (jsonDefPath) {
		jsonDefPath = path.posix.join(jsonDefPath);

		let jsonDef;
		let pathParsed = path.parse(jsonDefPath);
		let extensionOfFile = pathParsed.ext;
		let newSpriteSheetURL = path.posix.join(pathParsed.dir, pathParsed.name + '_png.png');
		newSpriteSheetURL = newSpriteSheetURL.startsWith('/') ? newSpriteSheetURL : '/' + newSpriteSheetURL;
		if (extensionOfFile === '.json') {
			jsonDef = JSON.parse(fs.readFileSync(jsonDefPath, { encoding: "utf8" }));
		} else if (extensionOfFile === '.js') {
			console.log('waiting');
			// jsonDef = (await jspmImport(jsonDefPath)).default;
		}
		console.log(newSpriteSheetURL);

		let newTexturePackerDef = generateTexturePackerDef(jsonDef, newSpriteSheetURL, width, height);
		
		let themeFileData = {
			url: newSpriteSheetURL,
			metadata: {
				spriteSheetPng: newTexturePackerDef
			}
		}
		let savePath = path.posix.join(path.parse(jsonDefPath).dir, path.parse(jsonDefPath).name + "_png");
		let jsonString = JSON.stringify(themeFileData);
		fs.writeFileSync(savePath + ".json", jsonString);
		fs.writeFileSync(savePath + ".js", "export default " + jsonString);
		console.log('end write');
	}
}

async function saveImg({url, width, height, fromPath}) {
	let browser = await puppeteer.launch({ headless: true });
	let page = await browser.newPage();
	let {name, dir} = path.parse(fromPath);
	await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
	await page.setViewport({ width: width || 0, height: height || 0 });
	await page.screenshot({
		path: path.posix.join(dir, name + '_png.png'),
		type: "png",
		fullPage: true,
		omitBackground: true
	});
	await page.close();
	await browser.close();
}

const generateTexturePackerDef = (jsonDef, newSpriteSheetURL, width, height) => {
	let keys = Object.keys(jsonDef);
	let newTexturePackerDef = {
		frames: {},
		meta: {}
	};
	let isFirst = false;
	for (let prop of keys) {
		let key = prop + "_png";
		let assetInfo = jsonDef[prop];
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
		newTexturePackerDef.frames[key] = generateFrameInfo(frameInfo);
	}
	return newTexturePackerDef;
}

const generateFrameInfo = (frameInfo) => {
	return {
		// "url": newSpriteSheetURL,
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
