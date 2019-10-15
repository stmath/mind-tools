'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.testComponentBundle = exports.testGame = undefined;

var _file = require('./common/file');

/**
 * runs tests for this game
 *
 * @returns
 */
var testGame = exports.testGame = function testGame() {
    var config = getPackageJsonField('mind');
    if (!config) {
        console.log('Missing mind section in package.json');
        return false;
    } else {
        if (!config.name) {
            console.log('Missing game name in mind section in package.json');
            return false;
        }
    }
    return true;
};

var testComponentBundle = exports.testComponentBundle = function testComponentBundle() {
    // check if the package's jspm config is pointing to the correct folder for the component bundles
    var jspmConfig = getPackageJsonField('jspm');
    // validate existence of lib property
    if (!jspmConfig || !jspmConfig.directories || !jspmConfig.directories.lib) {
        console.log('Unable to identify the jspm lib for components config');
        return false;
    }
    // validate lib property is correct
    if (jspmConfig.directories.lib != 'dist') {
        console.log('directory library folder for component bundles must be the dist folder');
        return false;
    }

    // check that the mind object includes details on bundling components
    var config = getPackageJsonField('mind');
    if (!config) {
        console.log('Missing mind section in package.json');
        return false;
    }
    // validate that componentBundles exist
    if (!config.componentBundles) {
        console.log('Missing component bundle configuration in package.json');
        return false;
    }

    return true;
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