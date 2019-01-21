'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.testGame = undefined;

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