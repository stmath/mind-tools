'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getBundleName = exports.uploadBundle = exports.setLogHandler = exports.uploadBundleComponents = exports.bundleComponents = exports.bundleGame = exports.bundleAssets = undefined;

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

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

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
var bundleGame = exports.bundleGame = function bundleGame(version, dest, hash, bundleOptions) {
    var name = getPackageJsonField('mind.name');
    var ret = false;
    if (typeof name === 'string' && name.length > 0) {
        var workingDirectory = getPackageJsonField('jspm.directories.lib');
        if (workingDirectory) {
            var spawn = _child_process2.default.spawnSync;
            // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
            var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
            var modulePath = (0, _file.createPath)(workingDirectory, name, name);
            logFn('Executing: jspm bundle ' + modulePath + ' - mind-sdk/**/* - mind-game-components/**/* ' + name + '.js.');
            logFn('Writing bundle ./' + name + '.js');

            var bundleCommand = modulePath + ' - mind-sdk/**/* - mind-game-components/**/*';

            var extraParams = [];
            // apply extra parameters for bundling the arena
            if (bundleOptions.minify) {
                extraParams.push('--minify');
                if (bundleOptions.noMangle) {
                    extraParams.push('--no-mangle');
                }
            }

            var res = spawn(command, ['bundle', bundleCommand, dest + name + '.js'].concat(extraParams), { stdio: "inherit" });
            if (!res.error && res.status === 0) {
                var requiresOutlines = getPackageJsonField('mind.forceRasterizedAssets');
                if (requiresOutlines) {
                    logFn('Generate Outlines.json to support forceRasterizedAssets');
                    var arenaAssetsDir = getPackageJsonField('mind.bundle-assets');
                    if (arenaAssetsDir) {
                        // iterate over all asset folders that the arena is bundling
                        var assetsDirs = arenaAssetsDir["assets"];
                        var svgFiles = [];
                        for (var iter = 0; iter < assetsDirs.length; iter++) {
                            var assetRoot = assetsDirs[iter];
                            // ignore the 'wildcard' characters, extractOutlinesFromFiles will step through sub folders
                            var substr = assetRoot.split('*')[0];
                            var _modulePath = (0, _file.createPath)(substr);
                            svgFiles = svgFiles.concat(extractOutlinesFromFiles(_modulePath, 'svg'));
                        }
                        writeOutlinesToJSON(dest, name, svgFiles);
                    }
                }
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
 * Used for mind-game-components repo. Bundle each available component and its assets
 * @param {String} version the string to apply to the compiled version of these bundles
 */
var bundleComponents = exports.bundleComponents = function bundleComponents(version, bundleOptions) {
    var success = true;
    // determine all the components that can be bundled from this repo
    var componentsToBundle = getPackageJsonField('mind.componentBundles');
    var bundleRoot = getPackageJsonField('mind.bundleRoot');
    // define properties that will be re-used for each component bundle process
    var spawn = _child_process2.default.spawnSync;
    var command = _os2.default.platform() === 'win32' ? 'jspm.cmd' : 'jspm';
    var subSDK = ' - mind-sdk/**/* ';

    // Setup iteration over all components that will be bundled
    var componentNames = Object.keys(componentsToBundle);
    var bundledAssets = [];
    var previousComponents = [];

    for (var iter = 0; iter < componentNames.length; iter++) {
        var name = componentNames[iter];
        var componentInfo = componentsToBundle[name];

        if (componentInfo.dist) {
            logFn('Bundling component: ' + name);
            // generate properties used by the bundling command
            var modulePath = componentInfo.dist; // the location of the code that will be compiled
            // create a string that defines which code should be removed from the component bundling
            // this can be used to remove some non-component specific code that may exist in the same folder
            var subtractComponents = '';
            var libToRemove = componentInfo.sub || [];
            libToRemove = libToRemove.concat(previousComponents);
            if (libToRemove) {
                for (var i = 0; i < libToRemove.length; i++) {
                    subtractComponents += ' - ' + libToRemove[i] + ' ';
                }
            }

            var plusComponents = '';
            var libToAdd = componentInfo.plus;
            if (libToAdd) {
                for (var _i = 0; _i < libToAdd.length; _i++) {
                    plusComponents += ' + ' + libToAdd[_i] + ' ';
                }
            }

            var bundleCommand = modulePath + ' ' + plusComponents + ' ' + subSDK + ' ' + subtractComponents + ' '; // composite command for bundling the component
            var bundleResult = (0, _file.createPath)(bundleRoot, version, componentInfo.bundleRoot, name + '.js');
            // apply extra parameters to the bundle call as necessary
            var extraParams = [];
            extraParams.push('--inject');
            extraParams.push('--skip-source-maps');
            // apply extra parameters for bundling the arena
            if (!bundleOptions.noMinify) {
                extraParams.push('--minify');
                if (bundleOptions.noMangle) {
                    extraParams.push('--no-mangle');
                }
            }
            // perform the bundle command
            var res = spawn(command, ['bundle', bundleCommand, bundleResult].concat(extraParams), { stdio: "inherit" });
            // check the result of the bundling
            if (!res.error && res.status === 0) {
                logFn('Bundled component to: ' + bundleResult);
            } else {
                // if there was an error, break from the bundling loop
                logFn('Error writing bundle: ' + bundleResult);
                success = false;
                break;
            }

            // remove core components from all subsequent components
            if (componentInfo.name === "CoreComponents") {
                previousComponents.push(bundleResult);
            }
        } else {
            logFn('Skipping code bundle for component: ' + name);
            var componentFolder = (0, _file.createPath)(bundleRoot, version, componentInfo.bundleRoot);
            _fs2.default.mkdirSync(componentFolder);
        }

        // bundle the assets that are related to this component as signified by properties in the package.json
        var assetBundle = bundleComponentAssets(componentInfo, version);
        if (assetBundle) bundledAssets.push(assetBundle);
    }
    // if every component bundled properly, then generate a json that holds neede configuration info
    if (success) writeComponentConfig(version, bundledAssets);
    // return the result of the component bundling
    return success;
};

var extractOutlineFromString = function extractOutlineFromString(fileStr) {
    // check for outline id in both single and double quotes
    var outlineIndex = fileStr.indexOf('id="outline"');
    if (outlineIndex < 0) fileStr.indexOf("id='outline'");
    if (outlineIndex > 0) {
        var endElement = fileStr.indexOf('/>', outlineIndex);
        var startElement = outlineIndex;
        while (fileStr.charAt(startElement) !== '<') {
            startElement--;
        }var extractedPath = fileStr.slice(startElement, endElement + 1);
        var doubleQuote = /"/gi;
        var newline = /(\r\n|\n|\r)/gm;
        extractedPath = extractedPath.replace(doubleQuote, "'");
        extractedPath = extractedPath.replace(newline, "");
        return extractedPath;
    }
    return null;
};

var extractOutlinesFromFiles = function extractOutlinesFromFiles(folderPath, type) {
    var relativeSrc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : undefined;

    var results = _fs2.default.readdirSync(folderPath, { withFileTypes: true });
    var svgs = [];

    for (var iter = 0; iter < results.length; iter++) {
        var res = results[iter];
        logFn('Results: ' + res + ' \n        Name: ' + res.name);
    }

    var files = results.filter(function (file) {
        return !file.isDirectory() && file.name.indexOf('.' + type) >= 0;
    });
    files.forEach(function (file) {
        var resolvedPath = _path2.default.resolve(folderPath + '/' + file.name);
        var contents = _fs2.default.readFileSync(resolvedPath, { encoding: 'utf-8' });
        var extractedPath = extractOutlineFromString(contents);
        if (extractedPath) {
            var name = relativeSrc !== undefined ? relativeSrc + '/' + file.name : folderPath + '/' + file.name;
            name = '/' + name; // relative url format
            svgs.push({ name: name, outline: extractedPath });
        }
    });

    var folders = results.filter(function (file) {
        return file.isDirectory();
    });
    folders.forEach(function (folder) {
        var updatedRelativeSrc = relativeSrc !== undefined ? relativeSrc + '/' + folder.name : undefined;
        var resolvedPath = _path2.default.resolve(folderPath + '/' + folder.name);
        logFn('Read assetsDirectory: ' + resolvedPath);
        svgs = svgs.concat(extractOutlinesFromFiles(resolvedPath, type, updatedRelativeSrc));
    });
    return svgs;
};

var writeOutlinesToJSON = function writeOutlinesToJSON(filePath, name, svgFiles, relativeDir) {
    var outlineJSONStr = '{';
    for (var iter = 0; iter < svgFiles.length; iter++) {
        var file = svgFiles[iter];
        var fileName = file.name;
        if (relativeDir !== undefined) {
            var trimmedName = fileName.split('/assets')[1];
            fileName = relativeDir + trimmedName;
        }
        outlineJSONStr += '\n"' + fileName + '": "' + file.outline + '"';
        if (iter + 1 < svgFiles.length) {
            outlineJSONStr += ',';
        }
    }
    outlineJSONStr += '}';

    var outlinePath = (0, _file.createPath)(filePath, name + '_Outlines.json');
    _fs2.default.writeFileSync(outlinePath, outlineJSONStr);
};

var bundleComponentAssets = function bundleComponentAssets(componentInfo, version) {
    // check if this component requires asset bundling
    var assetsSrc = componentInfo.assets;
    if (!assetsSrc) return;
    // define the path from which the assets will be bundled
    var relativeSrc = componentInfo.src;
    var assetsDirectory = _path2.default.resolve(relativeSrc);
    // define where the bundled assets will be stored
    var componentsDir = getPackageJsonField('mind.bundleRoot');
    var bundleDir = (0, _file.createPath)(componentsDir, version, componentInfo.bundleRoot); // should be 'components/{version}/{componentName}/'
    var bundlePath = (0, _file.createPath)(bundleDir, componentInfo.name + '.tar');
    var bundleName = _path2.default.resolve('./' + bundlePath);

    logFn('Read assetsDirectory: ' + assetsDirectory);
    var svgFiles = extractOutlinesFromFiles(assetsDirectory, 'svg', '');
    if (svgFiles.length > 0) {
        writeOutlinesToJSON(bundleDir, componentInfo.name, svgFiles, componentInfo.relativeAssetPath);
    }

    // call to nectar to bundle the assets
    (0, _nectar2.default)(assetsSrc, bundleName, { cwd: assetsDirectory });
    return {
        name: componentInfo.name,
        relativePath: componentInfo.relativeAssetPath,
        bundleRoot: '/' + bundleDir
    };
};

var writeComponentConfig = function writeComponentConfig(version, bundledAssets) {
    var componentMappingJSON = compileAssetMappingJSON(bundledAssets);
    var compositeJSON = JSON.stringify(componentMappingJSON);
    var bundlesStr = extractBundlesFromConfig();
    // compose the bundleJSONStr - and ready it to be written into the componentsConfig.json file
    var bundleJSONStr = '{\n        "componentSettings": ' + compositeJSON + ',\n        "systemJSConfig": {\n            ' + bundlesStr + '\n        }\n    }';

    var bundleRoot = getPackageJsonField('mind.bundleRoot');
    var configName = getPackageJsonField('mind.configName');
    var path = (0, _file.createPath)(bundleRoot, version, configName);
    _fs2.default.writeFileSync(path, bundleJSONStr);
};

var extractBundlesFromConfig = function extractBundlesFromConfig() {
    // This function will read the config.js for the components and extract the "bundles" property that was created via the --inject command
    var filePath = _path2.default.join("./", 'config.js');
    var data = _fs2.default.readFileSync(filePath, { encoding: 'utf-8' });
    var bundleIdx = data.indexOf('bundles: {');
    var subStr = data.slice(bundleIdx);
    var endIdx = subStr.indexOf('}');
    var bundlesStr = data.slice(bundleIdx - 1, bundleIdx + endIdx + 1);
    return bundlesStr.replace('bundles', '"bundles"');
};

var extractFromConfigJS = function extractFromConfigJS() {
    // This function will read the config.js and extract all setting inside the config parentheses "config(...)"
    var filePath = _path2.default.join("./", 'config.js');
    var data = _fs2.default.readFileSync(filePath, { encoding: 'utf-8' });
    var bundleIdx = data.indexOf('(') + 1;
    var subStr = data.slice(bundleIdx);
    var endIdx = subStr.indexOf(')');
    var bundlesStr = data.slice(bundleIdx, bundleIdx + endIdx);
    bundlesStr = bundlesStr.replace(/([{,])(\s*)([A-Za-z0-9_\-]+?)\s*:/g, '$1"$3":'); // add double quotes to keys
    return bundlesStr || '{}';
};

var uploadBundleComponents = exports.uploadBundleComponents = function uploadBundleComponents(version) {
    var promise = void 0;
    var uploadPromises = [];
    // determine all the components that can be bundled from this repo
    var componentsToBundle = getPackageJsonField('mind.componentBundles');
    // define properties that will be re-used for each component bundle process
    var s3folder = getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder,
        s3bucket = getPackageJsonField('mind.aws.s3bucket') || DEFAULTS.s3bucket;
    // define the root folder of the components bundles within the s3 bucket

    var componentRoot = 'components/';
    // get the properties for the config on the component bundles
    var configName = getPackageJsonField('mind.configName');
    var configPath = (0, _file.createPath)(componentRoot, version, configName);
    var targetConfigPath = (0, _file.createPath)(s3folder, componentRoot, version, configName);
    // attempt to upload the config json to s3
    var configJSONPromise = (0, _s2.upload)(configPath, targetConfigPath, s3bucket);
    uploadPromises.push(configJSONPromise);

    // Setup iteration over all components that will be bundled
    var componentNames = Object.keys(componentsToBundle);

    var _loop = function _loop(iter) {
        var bundleName = componentNames[iter];
        var componentInfo = componentsToBundle[bundleName];
        // generate the path to store the js and tar file for the components
        var bundleKey = (0, _file.createPath)(s3folder, componentRoot, version, componentInfo.bundleRoot, bundleName + '.js');
        // send the component's bundle js file up
        var bundlePath = (0, _file.createPath)(componentRoot, version, componentInfo.bundleRoot, bundleName + '.js');
        promise = (0, _s2.upload)(bundlePath, bundleKey, s3bucket).then(function (success) {
            if (success) {
                var assetsSrc = componentInfo.assets;
                if (assetsSrc) {
                    var tarKey = (0, _file.createPath)(s3folder, componentRoot, version, componentInfo.bundleRoot, bundleName + '.tar');
                    return (0, _s2.upload)(bundleName + '.tar', tarKey, s3bucket);
                }
            }
        });
        uploadPromises.push(promise);
    };

    for (var iter = 0; iter < componentNames.length; iter++) {
        _loop(iter);
    }
    return Promise.all(uploadPromises);
};

/**
 * Generate a JSON with property - "assetSettings" that is defined by a set of properties that maps
 * a given component bundle to a relative asset url for the component's bundled assets
 * Note: This mapping is stored in the package.json
 * @param {*} bundledAssets An array of Object that include component name and relative source for component assets
 */
var compileAssetMappingJSON = function compileAssetMappingJSON(bundledAssets) {
    var assetMapping = {};
    for (var i = 0; i < bundledAssets.length; i++) {
        var assetInfo = bundledAssets[i];
        assetMapping[assetInfo.name] = {
            relativePath: assetInfo.relativePath,
            bundleRoot: assetInfo.bundleRoot
        };
    }
    // return the object for assetSettings that will be read while unbundling component assets
    return {
        assetSettings: assetMapping
    };
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

        logFn('Uploading bundle to S3: bucket: ' + s3bucket + ', key: ' + bundleKey);
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
    // grab the sdk and component versions from the config file which may have been updated from the update call - 
    var sdkVersion = getTagFromMapString(getConfigJsField('map.mind-sdk')); // getPackageJsonField('jspm.dependencies.mind-sdk');
    var componentVersion = getTagFromMapString(getConfigJsField('map.mind-game-components')); //getPackageJsonField('jspm.dependencies.mind-game-components');
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
        'sdkBundleFile': DEFAULTS.s3folder + '/mind-sdk/mind-sdk-' + sdkVersion + '.js',
        'gameBundleFile': (0, _file.createPath)('/', folder, name, version, name + '.js'),
        'assetsBaseUrl': folder,
        'componentsConfigUrl': DEFAULTS.s3folder + '/components/' + componentVersion + '/ComponentsConfig.json',
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

var getFieldFromObj = function getFieldFromObj(obj, field) {
    var retObj = obj;
    if (typeof field === 'string' && field.length > 0) {
        field.split('.').forEach(function (p) {
            retObj = retObj && retObj[p];
        });
    }
    return retObj;
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

var getTagFromMapString = function getTagFromMapString() {
    var mapString = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

    var out = void 0;

    if (typeof mapString === 'string') {
        var splitArr = mapString.split('@');
        if (splitArr.length > 1) {
            out = splitArr[1];
        }
    }

    return out;
};

var getConfigJsField = function getConfigJsField(field) {
    var outVal = void 0;
    try {
        var configJSON = extractFromConfigJS();
        var configObj = JSON.parse('' + configJSON);
        outVal = getFieldFromObj(configObj, field);
    } catch (e) {
        console.warn(e);
    }

    return outVal;
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