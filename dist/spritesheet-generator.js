#!/usr/bin/env node
'use strict';

var _bundle = require('./lib/bundle');

var _test = require('./lib/test');

var _git = require('./lib/git');

var _file = require('./lib/common/file');

var _commandLineArgs = require('command-line-args');

var _commandLineArgs2 = _interopRequireDefault(_commandLineArgs);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _svgSpritesheetConvertToPNG = require('./lib/svgSpritesheetConvertToPNG');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var optionDefinitions = [{ name: 'gameName', type: String }, { name: 'folder', alias: 'f', type: String }, { name: 'name', alias: 'n', type: String }, { name: 'outlineIds', alias: 'o', type: String }, { name: 'rewriteTheme', alias: 'r', type: Boolean }, // if true, the found svg resource definitions found will be removed
{ name: 'spritesheetLoc', alias: 's', type: String }, { name: 'cropId', alias: 'c', type: String, defaultValue: 'outline' }, { name: 'ignoreCrop', type: Boolean }, { name: 'ignoreCropDraw', type: Boolean }, { name: 'removeSVGs', type: Boolean }, { name: 'debugEnabled', type: Boolean }];

var options = (0, _commandLineArgs2.default)(optionDefinitions);
if (options.outlineIds) {
	if (options.outlineIds.indexOf(',')) {
		options.outlineIds = options.outlineIds.split(',');
	} else {
		options.outlineIds = [options.outlineIds];
	}
	for (var iter = 0; iter < options.outlineIds.length; iter++) {
		console.log(options.outlineIds[iter]);
	}
}

// if not provided define options based on expected naming conventions
options.folder = options.hasOwnProperty('folder') ? options.folder : 'assets/' + options.gameName;
options.name = options.hasOwnProperty('name') ? options.name : '' + options.gameName;
options.outlineIds = options.hasOwnProperty('outlineIds') ? options.outlineIds : ['outline'];
options.spritesheetLoc = options.hasOwnProperty('spritesheetLoc') ? options.spritesheetLoc : 'PixiArenas/' + options.gameName + '/spritesheet';

console.log('finding assets in: ' + options.folder);
var folderPath = options.folder;
var name = options.name;
(0, _svgSpritesheetConvertToPNG.convertSpritesheet)(folderPath, name, options);