#!/usr/bin/env node
import {bundleGame, bundleAssets, uploadBundle, setLogHandler, getBundleName} from './lib/bundle';
import {testGame} from './lib/test';
import {getLastTag, addTag, getLastCommitHash} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';
import child_process from 'child_process';

import {wrapperFunction, generatePNG, convertSpritesheet} from './lib/svgSpritesheetConvertToPNG';

const optionDefinitions = [
	{ name: 'gameName', type: String},
	{ name: 'folder', alias: 'f', type: String},
	{ name: 'name', alias: 'n', type: String},
	{ name: 'outlineIds', alias: 'o', type: String},
	{ name: 'rewriteTheme', alias: 'r', type: Boolean}, // if true, the found svg resource definitions found will be removed
	{ name: 'spritesheetLoc', alias: 's', type: String},
	{ name: 'cropId', alias: 'c', type: String, defaultValue: 'outline'},
	{ name: 'ignoreCrop', type: Boolean},
	{ name: 'ignoreCropDraw', type: Boolean},
	{ name: 'removeSVGs', type: Boolean},
	{ name: 'debugEnabled', type: Boolean}
];

const options = commandLineArgs(optionDefinitions);
if (options.outlineIds) {
	if (options.outlineIds.indexOf(',')) {
		options.outlineIds = options.outlineIds.split(',');
	} else {
		options.outlineIds = [options.outlineIds];
	}
	for (let iter = 0; iter < options.outlineIds.length; iter++) {
		console.log(options.outlineIds[iter]);
	}
}

// if not provided define options based on expected naming conventions
options.folder = options.hasOwnProperty('folder') ? options.folder : `assets/${options.gameName}`;
options.name = options.hasOwnProperty('name') ? options.name : '' + options.gameName;
options.outlineIds = options.hasOwnProperty('outlineIds') ? options.outlineIds : ['outline'];
options.spritesheetLoc = options.hasOwnProperty('spritesheetLoc') ? options.spritesheetLoc : `PixiArenas/${options.gameName}/spritesheet`;

console.log('finding assets in: ' + options.folder); 
let folderPath = options.folder;
let name = options.name;
convertSpritesheet(folderPath, name, options);
