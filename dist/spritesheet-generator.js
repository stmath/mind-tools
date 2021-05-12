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

console.log('hello there');
var optionDefinitions = [{ name: 'spritesheet', alias: 's', type: String }, { name: 'folder', alias: 'f', type: String }];

var options = (0, _commandLineArgs2.default)(optionDefinitions);

console.log('finding assets in: ' + options.folder);

// todo:
// args for
// folder
// outlines
// optimization


(0, _svgSpritesheetConvertToPNG.convertSpritesheet)(options.folder);

// console.log('generatePNG for: ' + options.spritesheet);
// wrapperFunction(options.spritesheet);