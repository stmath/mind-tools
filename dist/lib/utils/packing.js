'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.pack = pack;

var _binpacker = require('./binpacker');

var _growingpacker = require('./growingpacker');

var _basicpacker = require('./basicpacker');

var algorithms = {
	'binpacking': binpackingStrict,
	'growing-binpacking': growingBinpacking,
	'horizontal': horizontal,
	'vertical': vertical
}; // derived from https://github.com/Gamefroot/Gamefroot-Texture-Packer/blob/kiwi/lib/packing/index.js
// debugger;
function pack(algorithm, files, options) {
	algorithm = algorithm || 'growing-binpacking';
	var remainingFiles = files.concat();
	options.atlases = [];
	while (!options.maxAtlases || options.atlases.length < options.maxAtlases) {
		// Details for this texture group
		var group = {
			width: options.width,
			height: options.height
		};
		// Perform the fit
		algorithms[algorithm](remainingFiles, group);

		// Find out which files were fit
		var insertedFiles = [];
		var i = remainingFiles.length;
		// eslint-disable-next-line no-magic-numbers
		while (--i >= 0) {
			var item = remainingFiles[i];
			if (item.fit) {
				item.x = item.fit.x;
				item.y = item.fit.y;
				delete item.fit;
				delete item.w;
				delete item.h;

				if (item.files) {
					// If this is a group, add all of the groups files
					item.files.forEach(function (file) {
						file.x = file.fit.x + item.x;
						file.y = file.fit.y + item.y;
						delete file.fit;
						delete file.w;
						delete file.h;
						insertedFiles.push(file);
					});
				} else {
					// Otherwise just add the single file
					insertedFiles.push(item);
				}
				// eslint-disable-next-line no-magic-numbers
				remainingFiles.splice(i, 1);
			}
		}

		// If we didn't insert any files, don't continue
		// eslint-disable-next-line no-magic-numbers
		if (insertedFiles.length === 0) {
			break;
		} else {
			// Otherwise add another texture group to the result
			group.files = insertedFiles;
			options.atlases.push(group);
		}
	}

	// If we stopped before all the files were packed
	// We either need to throw an error or make a record
	// of said files
	// eslint-disable-next-line no-magic-numbers
	if (remainingFiles.length > 0) {
		remainingFiles.forEach(function (file) {
			options.excludedFiles.push(file);
		});
		if (options.validate) {
			throw new Error('Can\'t fit all textures in given dimensions');
		}
	}
};

exports.blockGroups = function (algorithm, files, options) {
	algorithm = algorithm || 'growing-binpacking';
	var groups = [];
	files.forEach(function (file) {
		if (file.hasOwnProperty('group')) {
			// eslint-disable-next-line no-magic-numbers
			while (groups.length - 1 < file.group) {
				groups.push([]);
			}
			groups[file.group].push(file);
		}
	});
	for (var i = 0; i < groups.length; i++) {
		var group = groups[i];
		// eslint-disable-next-line no-magic-numbers
		if (group.length > 0) {
			var block = { width: options.width, height: options.height };
			algorithms[algorithm](group, block);
			block.w = block.width;
			block.h = block.height;
			block.group = i;
			block.files = [];

			var didFit = true;
			group.forEach(function (file) {
				// eslint-disable-next-line no-magic-numbers
				files.splice(files.indexOf(file), 1);
				if (!file.fit) {
					didFit = false;
					options.excludedFiles.push(file);
				} else {
					block.files.push(file);
				}
			});
			if (didFit) {
				files.push(block);
			}
		}
	}
};

function growingBinpacking(files, group) {
	var packer = new _growingpacker.GrowingPacker(group.width, group.height);
	packer.fit(files);
	group.width = packer.root.w;
	group.height = packer.root.h;

	// for (var n = 0; n < files.length; n++) {
	// 	var block = files[n];
	// 	if (block.fit) {
	// 		console.log(block.fit.x + ', ' + block.fit.y + ', ' + block.w + ', ' + block.h);
	// 	}
	// }
};

function binpackingStrict(files, group) {
	var packer = new _binpacker.BinPacker(group.width, group.height);
	packer.fit(files);
	group.width = packer.root.w;
	group.height = packer.root.h;
};

function horizontal(files, group) {
	var packer = new _basicpacker.BasicPacker(_basicpacker.BasicPacker.HORIZONTAL, group.width, group.height);
	packer.fit(files);
	group.width = packer.width;
	group.height = packer.height;
}

function vertical(files, group) {
	var packer = new _basicpacker.BasicPacker(_basicpacker.BasicPacker.VERTICAL, group.width, group.height);
	packer.fit(files);
	group.width = packer.width;
	group.height = packer.height;
};