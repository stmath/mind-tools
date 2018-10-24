'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _nectar = require('nectar');

var _nectar2 = _interopRequireDefault(_nectar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
var getJsonFile = function getJsonFile(jsonFile) {
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

var getPackageJsonField = function getPackageJsonField(field) {
    if (!getPackageJsonField.cache) {
        getPackageJsonField.cache = getJsonFile('package.json');
    }

    var retObj = getPackageJsonField.cache.content;
    if (typeof field === 'string' && field.length > 0) {
        retObj = field.split('.').reduce(function (p) {
            return retObj[p] || {};
        }, retObj);
    }
    return retObj;
};

var getPackageJsonFields = function getPackageJsonFields() {
    var ns = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var fields = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    var ret = [];
    if (typeof ns !== 'string') {
        ns = '';
    }
    if (Array.isArray(fields)) {
        ret = fields.map(function (f) {
            return getPackageJsonField(ns + f);
        });
    }
    return ret;
};

var bundleAssets = function bundleAssets() {
    var _getPackageJsonFields = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']),
        _getPackageJsonFields2 = _slicedToArray(_getPackageJsonFields, 2),
        assets = _getPackageJsonFields2[0],
        output = _getPackageJsonFields2[1];

    if (assets && output) {
        (0, _nectar2.default)(assets, output);
    }
};

var writeManifest = function writeManifest(gameName) {
    var sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    var dump = '{\n        "module": "' + gameName + '",\n        "arenaKey": "PixiArenas/' + gameName + '/' + gameName + '",\n        "sdkBundleFile": "/pilot/sdk/mind-sdk-' + sdkVersion + '.js",\n        "gameBundleFile": "/pilot/arenas/' + gameName + '.js",\n        "assetsBaseUrl": "/pilot",\n        "systemJsConfig": {\n            "map": {\n                "mind-sdk": "mind:mind-sdk@' + sdkVersion + '"\n            }\n        }\n    }';

    fs.writeFileSync('PixiArenas/' + gameName + '/' + gameName + '.manifest.json', dump);
};