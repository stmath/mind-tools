#!/usr/bin/env node
import {bundleGame, bundleAssets, uploadBundle, setLogHandler, getBundleName} from './lib/bundle';
import {testGame} from './lib/test';
import {getLastTag, addTag, getLastCommitHash} from './lib/git';
import {mkdir} from './lib/common/file';
import commandLineArgs from 'command-line-args';
import child_process from 'child_process';

import {wrapperFunction, generatePNG, convertSpritesheet} from './lib/svgSpritesheetConvertToPNG';

console.log('hello there');
const optionDefinitions = [
	{ name: 'spritesheet', alias: 's', type: String},
	{ name: 'folder', alias: 'f', type: String}
];

const options = commandLineArgs(optionDefinitions);

console.log('finding assets in: ' + options.folder); 

// todo:
// args for
// folder
// outlines
// optimization


convertSpritesheet(options.folder);


// console.log('generatePNG for: ' + options.spritesheet);
// wrapperFunction(options.spritesheet);