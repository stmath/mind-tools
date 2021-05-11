
const Utils = require('../utils/utils');
// const exec = require('child_process').execSync; // from node
const ERROR_EXIT = 1;

module.exports = function (gulp, plugins, cmds, packageJson) {
	let src = cmds[Utils.MIND_COMMAND_PREFIX + 'src'];
	let fitTo = cmds[Utils.MIND_COMMAND_PREFIX + 'fitTo'];
	let prefix = cmds[Utils.MIND_COMMAND_PREFIX + 'prefix'];

	function _runTask () {
		if (src) {
			let isRelative = false;
			Utils.optimizeSvg(src, isRelative, { fitTo, prefix });
		} else {
			console.error('Please provide a source.');
			process.exit(ERROR_EXIT);
		}
	};

	function _help () {
		console.log('---');
		console.log('svgOptimize ' + Utils.MIND_COMMAND_PREFIX + 'src <./path/to/svg/folder/> ');
		console.log('*  Will get all svgs in a folder and crop any white space out. Does not recurse into subfolders to avoid naming conflicts of files and ids.');
		console.log('');
		console.log('-    src: Name of your game must be included. Must be the same name as your GameName.js file.');
		console.log('');
		console.log('-    prefix: Whether to prefix ids with filename. Prevents conflicts of ids in svg spritesheets.');
		console.log('');
		console.log('');
		process.exit();
	}

	// give user help on the command if requested
	if (cmds.hasOwnProperty('help') || cmds.hasOwnProperty(Utils.MIND_COMMAND_PREFIX + 'help')) {
		return _help;
	}

	// else return task function
	return _runTask;
};
