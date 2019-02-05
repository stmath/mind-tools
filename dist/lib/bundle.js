'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getBundleName = exports.uploadBundle = exports.setLogHandler = exports.bundleGame = exports.bundleAssets = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _nectar = require('nectar');

var _nectar2 = _interopRequireDefault(_nectar);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _file = require('./common/file');

var _s2 = require('./s3');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Bundle assets defined in mind.bundle-assets.assets = [] & mind.bundle-assets.output = ''
 * Returns a promise that end with true if succeed.
 *
 * @param {String} dest: Destination directory
 * @returns {Object<Promise>}
 */
var bundleAssets = exports.bundleAssets = function bundleAssets(dest) {
    var _getPackageJsonFields = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']),
        _getPackageJsonFields2 = _slicedToArray(_getPackageJsonFields, 2),
        assets = _getPackageJsonFields2[0],
        output = _getPackageJsonFields2[1];

    var ret = Promise.resolve(true);
    if (assets && output && assets.length > 0 && output.length > 0) {
        var destPath = (0, _file.createPath)(dest, output);
        var mkdirRes = (0, _file.mkdir)(destPath.substr(0, destPath.lastIndexOf('/')));
        if (mkdirRes.ok) {
            ret = (0, _nectar2.default)(assets, destPath).then(function (_) {
                return true;
            }).catch(function (error) {
                logFn('Error on bundle assets ' + error.message);
                return false;
            });
        } else {
            logFn('Error on bundle assets. Can\'t create a ' + destPath + ' directory. Fail with message: ' + mkdirRes.message);
            ret = Promise.resolve(false);
        }
    } else {
        logFn('No assets field on package.json. mind.bundle-assets.{assets | output}');
    }
    return ret;
};

/**
 * Bundle game in a promise which ends with true is succed.
 *
 * @param {string} name: Name of Game.
 * @param {string/number} version: Game version
 * @returns {boolean}: True if succeeds
 */
var bundleGame = exports.bundleGame = function bundleGame(version, dest, hash) {
    var name = getPackageJsonField('mind.name');
    var ret = false;
    if (typeof name === 'string' && name.length > 0) {
        var workingDirectory = getPackageJsonField('jspm.directories.lib');
        if (workingDirectory) {
            var spawn = _child_process2.default.spawnSync;
            // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
            var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
            var modulePath = (0, _file.createPath)(workingDirectory, name, name);
            logFn('Executing: jspm bundle ' + modulePath + ' - mind-sdk/**/* ' + name + '.js.');
            logFn('Writing bundle ./' + name + '.js');
            var res = spawn(command, ['bundle', modulePath + ' - mind-sdk/**/*', dest + name + '.js'], { stdio: "inherit" });
            if (!res.error && res.status === 0) {
                logFn('Writing manifest ./manifest.json');
                writeManifest(name, modulePath, version, dest, hash);
                ret = true;
            } else {
                logFn('Error: Jspm finish with status ' + res.status + ' and error: ' + res.error + '.');
            }
        } else {
            logFn('Can\t find jspm.directories.lib in package.json');
        }
    } else {
        logFn('No bundle name (mind.name) found in package.json');
    }
    return ret;
};

/**
 * Set log function. E.g: console.log
 *
 * @param {object<function>} handlerFn: Function.
 * @returns
 */
var setLogHandler = exports.setLogHandler = function setLogHandler(handlerFn) {
    if (typeof handlerFn === 'function') {
        logFn = handlerFn;
    }
};

/**
 * Upload the given bundle.
 *
 * @param {string} name: Name of bundle file.
 * @param {string/number} version: Game version
 * @returns {object<Promise>}: Ends with true if succeeds.
 */
var uploadBundle = exports.uploadBundle = function uploadBundle(version) {
    var bundleName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    bundleName = bundleName || getPackageJsonField('mind.name');
    var promise = void 0;
    if (typeof bundleName === 'string' && bundleName.length > 0) {
        var s3folder = getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder,
            s3bucket = getPackageJsonField('mind.aws.s3bucket') || DEFAULTS.s3bucket;


        var bundleKey = (0, _file.createPath)(s3folder, bundleName, version, bundleName + '.js');
        var manifestKey = (0, _file.createPath)(s3folder, bundleName, version, 'manifest.json');

        logFn('Uploading bundlet to S3: bucket: ' + s3bucket + ', key: ' + bundleKey);
        promise = (0, _s2.upload)(bundleName + '.js', bundleKey, s3bucket).then(function (success) {
            logFn('Uploading manifest to S3: bucket: ' + s3bucket + ', key: ' + manifestKey);
            if (success) {
                return (0, _s2.upload)('manifest.json', manifestKey, s3bucket);
            }
        });
    } else {
        promise = Promise.reject(new Error('Invalid bundle name'));
    }
    return promise;
};

/**
 * Get Bundle Name
 *
 * @returns {string}: Bundle name.
 */
var getBundleName = exports.getBundleName = function getBundleName() {
    return getPackageJsonField('mind.name');
};

var writeManifest = function writeManifest(name, arenakey, version, dest, hash) {
    var sdkVersion = getPackageJsonField('jspm.dependencies.mind-sdk');
    var folder = getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder;

    var _getPackageJsonFields3 = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']),
        _getPackageJsonFields4 = _slicedToArray(_getPackageJsonFields3, 2),
        assets = _getPackageJsonFields4[0],
        output = _getPackageJsonFields4[1];

    var webAppOptions = getPackageJsonField('mind.webAppOptions');
    var testHarnessOptions = getPackageJsonField('mind.testHarnessOptions');
    var overrides = getPackageJsonField('mind.overrides');
    var buildDate = (0, _momentTimezone2.default)().tz('America/Los_Angeles').format();
    var manifest = {
        'module': name,
        'arenaKey': arenakey,
        'version': version,
        'buildDate': buildDate,
        'commit': hash,
        'sdkBundleFile': '/pilot/sdk/mind-sdk-' + sdkVersion + '.js',
        'gameBundleFile': (0, _file.createPath)('/', folder, name, version, name + '.js'),
        'assetsBaseUrl': folder,
        'systemJsConfig': {
            'map': {
                'mind-sdk': 'mind:mind-sdk@' + sdkVersion
            }
        }
    };
    if (assets && output && assets.length > 0 && output.length > 0) {
        manifest.assetsBundleFile = (0, _file.createPath)('/', name, version, output + '.gz');
    }
    if (webAppOptions) {
        manifest.webAppOptions = webAppOptions;
    }
    if (testHarnessOptions) {
        manifest.testHarnessOptions = testHarnessOptions;
    }
    if (overrides) {
        manifest.overrides = overrides;
    }

    try {
        _fs2.default.writeFileSync(dest + 'manifest.json', JSON.stringify(manifest, null, 2));
    } catch (e) {
        logFn('Error writing manifest: ' + e);
    }
};

var getPackageJsonField = function getPackageJsonField(field) {
    if (!getPackageJsonField.cache) {
        getPackageJsonField.cache = (0, _file.getJsonFile)('package.json');
    }
    var retObj = getPackageJsonField.cache.content;
    if (typeof field === 'string' && field.length > 0) {
        field.split('.').forEach(function (p) {
            retObj = retObj && retObj[p];
        });
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
        ret = fields.filter(function (f) {
            return typeof f === 'string' && f.length > 0;
        }).map(function (f) {
            return getPackageJsonField([ns, f].join('.'));
        });
    }
    return ret;
};

var logFn = function logFn(_) {};

var DEFAULTS = {
    s3bucket: 'mri-game-conversion',
    s3folder: '/Content_HTML5'
};