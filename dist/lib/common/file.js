'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.mv = exports.mkdir = exports.createPath = exports.getJsonFile = exports.contentType = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Get content Type from file name
 *
 * @param {string} fileName: File name.
 * @returns {string}: Content type
 */
var contentType = exports.contentType = function contentType(fileName) {
	var contentType = void 0;
	if (typeof fileName !== 'string') {
		fileName = '';
	}
	var contentTypes = [['', 'application/octet-stream'], ['.html', 'text/html'], ['.css', 'text/css'], ['.json', 'application/json'], ['.js', 'application/x-javascript'], ['.png', 'image/png'], ['.jpg', 'image/jpg'], ['.svg', 'image/svg+xml']];

	var type = contentTypes.pop();
	var name = fileName.toLowerCase();
	do {
		if (name.endsWith(type[0])) {
			contentType = type[1];
		}
		type = contentTypes.pop();
	} while (contentType !== undefined);

	return contentType;
};

/**
 * Read and parse json file.
 * {
 *      content: {...} or undefined
 *      error: error string or undefined
 * }
 *
 * @param {string} jsonFile: File name.
 * @returns {object}:
 */
var getJsonFile = exports.getJsonFile = function getJsonFile(jsonFile) {
	var ret = { content: undefined, error: undefined };
	var rawData = void 0;
	if (typeof jsonFile === 'string' && jsonFile.length > 0) {
		try {
			rawData = _fs2.default.readFileSync(jsonFile, 'utf8');
		} catch (error) {
			ret.error = 'Error: Fail to reading package.json. Exception: ' + error;
		}
		if (rawData) {
			try {
				ret.content = JSON.parse(rawData);
			} catch (error) {
				ret.error = 'Error: Can\'t parse json format. Exception: ' + error;
			}
		}
	} else {
		ret.error = 'Error: Invalid file name.';
	}

	return ret;
};

/**
 * Creates a path:
 *  Usage: createPath('/home', '/user', 'dir/', 'dir2', 'file.txt') -> /home/user/dir/dir2/file.txt
 * 		   createPath('home', 'user', 'dir/', 'dir2', 'file.txt') -> home/user/dir/dir2/file.txt
 *         createPath('/', 'home', 'user', 'dir/', 'dir2', 'file.txt') -> /home/user/dir/dir2/file.txt
 * 		   createPath('/home/user//dir', 'dir2', '///file.txt') -> /home/user/dir/dir2/file.txt
 *
 * @param {*} args
 * @returns
 */
var createPath = exports.createPath = function createPath() {
	for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
		args[_key] = arguments[_key];
	}

	var prefix = typeof args[0] === 'string' && args[0].startsWith('/') ? '/' : '';
	return prefix + args.filter(function (a) {
		return ['string', 'number'].includes(typeof a === 'undefined' ? 'undefined' : _typeof(a)) && a !== '/';
	}).map(function (a) {
		return String(a);
	}).map(function (a) {
		return a.split('/').filter(function (e) {
			return e.length > 0;
		}).join('/');
	}) // Remove extra /
	.join('/');
};

/**
 * Recursively create a directory.
 * Returns and object with ok & message props:  ok is true if succeed or the directory already exist,
 * while message contains any exception message.
 *
 * @param {String} path
 * @returns {object}
 */
var mkdir = exports.mkdir = function mkdir(path) {
	path = createPath(path);
	var ret = {
		ok: true,
		message: false
	};
	if (path && !_fs2.default.existsSync(path)) {
		try {
			_fs2.default.mkdirSync(path, { recursive: true });
		} catch (err) {
			ret.ok = false;
			ret.err = true;
			ret.message = err.message;
		}
	}
	return ret;
};

var mv = exports.mv = function mv(oldPath, newPath) {
	return _fs2.default.renameSync(oldPath, newPath);
};