'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _xmldom = require('xmldom');

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MYDOMPARSER = new _xmldom.DOMParser();

var STRING_MIN_INDEX_ALLOWED = 0;
var NODE_ENUM = {};
NODE_ENUM.ELEMENT_NODE = 1;
NODE_ENUM.TEXT_NODE = 3;
NODE_ENUM.PROCESSING_INSTRUCTION_NODE = 7;
NODE_ENUM.COMMENT_NODE = 8;
NODE_ENUM.DOCUMENT_NODE = 9;
NODE_ENUM.DOCUMENT_TYPE_NODE = 10;
NODE_ENUM.DOCUMENT_FRAGMENT_NODE = 11;

module.exports = function () {
	var utilsNameSpace = {};

	utilsNameSpace.MIND_COMMAND_PREFIX = '---';
	utilsNameSpace.DEFAULT_SVG_OUTLINE_ID = 'transparent_outline';

	function _visitNode(node, callback) {
		if (callback(node)) {
			return true;
		}

		node = node.firstChild;
		if (node) {
			do {
				if (_visitNode(node, callback)) {
					return true;
				}
				node = node.nextSibling;
			} while (node);
		}
	}

	utilsNameSpace.getNodesByTagName = function (tagName, base) {
		var ls = [];

		_visitNode(base, function (node) {
			if (node !== base && node.nodeType && (tagName === '*' || node.tagName === tagName)) {
				ls.push(node);
			}
		});
		return ls;
	};

	/**
 utilsNameSpace.cropSvg = function (src, isRelative = true, options = {}) {
 	if (src) {
 		let pathNames = [];
 		let isDirectory = fs.lstatSync(src).isDirectory();
 		if (isDirectory) {
 			let files = fs.readdirSync(src);
 			files.forEach((fileName) => {
 				if (path.extname(fileName) === '.svg') {
 					// spritesheets can get large lets skip these.
 					// also spritesheets determine whether or not they
 					// should crop during generation, lets not overwrite that.
 					if (!fileName.endsWith('_spriteSheet.svg')) {
 						let pathName = path.join(src, fileName);
 						if (isRelative) {
 							pathName = path.resolve(pathName);
 						}
 						pathNames.push(pathName);
 					}
 				}
 			});
 		} else {
 			if (path.extname(src) === '.svg') {
 				let pathName;
 				if (isRelative) {
 					pathName = path.resolve(src);
 				} else {
 					pathName = src;
 				}
 				pathNames.push(pathName);
 			}
 		}
 
 		if (pathNames.length) {
 			const { cropLayer = '' } = options;
 			pathNames.forEach((pathName) => {
 				let formattedName = utilsNameSpace.replaceAll(pathName, '\\', '/'); // forward slash supported by all OS's.
 
 				if (path.extname(formattedName) === '.svg') {
 					let osvar = process.platform;
 					let inkscapeCmd = '';
 					let inkscapeCmdSuffix = '';
 
 					if (osvar === 'darwin') {
 						inkscapeCmd = '/Applications/Inkscape.app/Contents/Resources/bin/inkscape';
 					} else if (osvar === 'linux') {
 						inkscapeCmd = 'inkscape';
 					} else if (osvar === 'win32') {
 						inkscapeCmd = '"C:/Progra~1/Inkscape/inkscape.exe"';
 					} else {
 						console.log('Not sure what OS you are running. Let us know if you get this error.');
 					}
 
 					if (inkscapeCmd) {
 						inkscapeCmdSuffix = `--select=${cropLayer || utilsNameSpace.DEFAULT_SVG_OUTLINE_ID} --verb=FitCanvasToSelectionOrDrawing --verb=FileSave --verb=FileQuit "${pathName}"`;
 					}
 
 					if (inkscapeCmd && inkscapeCmdSuffix) {
 						child_process.execSync(`${inkscapeCmd} ${inkscapeCmdSuffix}`);
 						child_process.execSync(`${inkscapeCmd} "${pathName}" --export-plain-svg="${pathName}"`);
 						utilsNameSpace.optimizeSvg(pathName);
 					}
 				}
 			});
 		} else {
 			console.error('Could not format the src path. Was a valid src path provided.');
 		}
 	}
 };
 */

	/**
 function _runOptimize (data, pathName, options) {
 	const { prefix } = options;
 
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
 
 	console.log(options);
 	console.log(svgoOpts);
 
 	const svgo = new SVGO(svgoOpts);
 
 	svgo.optimize(data, { path: pathName }).then(function (result) {
 		let didChange = result !== data;
 		if (didChange) {
 			try {
 				console.log(result.path, result.info);
 				fs.writeFileSync(pathName, result.data, 'utf8');
 			} catch (e) {
 				console.error(e);
 			}
 		}
 
 		// {
 		//     // optimized SVG data string
 		//     data: '<svg width="10" height="20">test</svg>'
 		//     // additional info such as width/height
 		//     info: {
 		//         width: '10',
 		//         height: '20'
 		//     }
 		// }
 	});
 }
 */

	/**
 	utilsNameSpace.optimizeSvg = function (src, isRelative = true, options) {
 		if (src) {
 			let pathNames = [];
 			let isDirectory = fs.lstatSync(src).isDirectory();
 			if (isDirectory) {
 				let files = fs.readdirSync(src);
 				files.forEach((fileName) => {
 					if (path.extname(fileName) === '.svg') {
 						// spritesheets can get large lets skip these.
 						// also spritesheets determine whether or not they
 						// should crop during generation, lets not overwrite that.
 						if (!fileName.endsWith('_spriteSheet.svg')) {
 							let pathName = path.join(src, fileName);
 							if (isRelative) {
 								pathName = path.resolve(pathName);
 							}
 							pathNames.push(pathName);
 						}
 					}
 				});
 			} else {
 				if (path.extname(src) === '.svg') {
 					let pathName;
 					if (isRelative) {
 						pathName = path.resolve(src);
 					} else {
 						pathName = src;
 					}
 					pathNames.push(pathName);
 				}
 			}
 
 			if (pathNames.length) {
 				pathNames.forEach((pathName) => {
 					let formattedName = utilsNameSpace.replaceAll(pathName, '\\', '/'); // forward slash supported by all OS's.
 
 					if (path.extname(formattedName) === '.svg') {
 						let paramData = fs.readFileSync(pathName, 'utf8');
 						if (paramData) {
 							const SVGDOM = MYDOMPARSER.parseFromString(paramData);
 							const transparentOutlineElem = SVGDOM.getElementById(utilsNameSpace.DEFAULT_SVG_OUTLINE_ID);
 							if (!SVGDOM.getElementById('outline') && transparentOutlineElem) {
 								let pathElems = transparentOutlineElem.getElementsByTagName('path');
 								const NO_OPACITY = 0;
 								if (pathElems) {
 									for (let i = 0; i < pathElems.length; i++) {
 										let strokeVal = pathElems[i].getAttribute('stroke');
 										let strokeOpacityVal = pathElems[i].getAttribute('stroke-opacity');
 
 										if (strokeVal && (strokeVal !== 'none') && (Number(strokeOpacityVal) === NO_OPACITY)) {
 											pathElems[i].setAttribute('id', 'outline');
 											break;
 										}
 									}
 								}
 							}
 
 							// ensure widths and heights are included
 							let viewBox = SVGDOM.documentElement.getAttribute("viewBox") ? SVGDOM.documentElement.getAttribute("viewBox").trim().split(/\s+/g) : [0, 0, 0, 0];
 							if (!SVGDOM.documentElement.getAttribute("width")) {
 								SVGDOM.documentElement.setAttribute("width", viewBox[2]);
 							}
 							if (!SVGDOM.documentElement.getAttribute("height")) {
 								SVGDOM.documentElement.setAttribute("height", viewBox[3]);
 							}
 
 							let data = SVGDOM.documentElement.outerHTML ? SVGDOM.documentElement.outerHTML : SVGDOM.documentElement.toString();
 
 							_runOptimize(data, pathName, options);
 						};
 					}
 				});
 			} else {
 				console.error('Could not format the src path. Was a valid src path provided.');
 			}
 		}
 	};
  */

	/**
 utilsNameSpace.getMindCommands = function () {
 	const out = {};
 	var args = process.argv;
 	var argLength = args.length;
 	var currArg = '';
 	var nextArg = '';
 	const LAST_INDEX_SHIFT = 1;
 	const NEXT_INDEX_SHIFT = 1;
 	for (var iArg = 0; iArg < argLength; iArg++) {
 		currArg = args[iArg].trim();
 		nextArg = (iArg < (argLength - LAST_INDEX_SHIFT)) ? args[iArg + NEXT_INDEX_SHIFT].trim() : '';
 		if (currArg.startsWith(utilsNameSpace.MIND_COMMAND_PREFIX) && !nextArg.startsWith('-')) {
 			out[currArg] = nextArg;
 		}
 	}
 	return out;
 };
 
 utilsNameSpace.isFixed = function (file) {
 	// Has ESLint fixed the file contents?
 	return file.eslint != null && file.eslint.fixed;
 };
 
 utilsNameSpace.replaceAll = function (wholeString, strToReplace, strToReplaceWith) {
 	while (wholeString.indexOf(strToReplace) >= STRING_MIN_INDEX_ALLOWED) {
 		var newStr = wholeString.replace(strToReplace, strToReplaceWith);
 		wholeString = newStr;
 	}
 
 	return wholeString;
 };
 */
	return utilsNameSpace;
}();