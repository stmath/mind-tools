
const Utils = require('../utils/utils');
// const exec = require('child_process').execSync; // from node
const ERROR_EXIT = 1;

module.exports = function (gulp, plugins, cmds, packageJson) {
	let src = cmds[Utils.MIND_COMMAND_PREFIX + 'src'];
	let cropLayer = cmds[Utils.MIND_COMMAND_PREFIX + 'cropLayer'];

	function _runTask () {
		if (src) {
			let isRelative = false;
			Utils.cropSvg(src, isRelative, { cropLayer });
		} else {
			console.error('Please provide a source.');
			process.exit(ERROR_EXIT);
		}
	};

	function _help () {
		console.log('---');
		console.log('svgCrop ' + Utils.MIND_COMMAND_PREFIX + 'src <./path/to/svg/folder/> ');
		console.log('  Will get all svgs in a folder and crop any white space out');
		console.log('');
		console.log('    src: Name of your game must be included. Must be the same name as your GameName.js file.');
		console.log(`    cropLayer: Element ID to crop to. Defaults to '${Utils.DEFAULT_SVG_OUTLINE_ID}'. If ID does not exists, crops to drawing.`);
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
