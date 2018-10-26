'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.addTag = exports.getLastTag = exports.getTags = undefined;

var _simpleGit = require('simple-git');

var _simpleGit2 = _interopRequireDefault(_simpleGit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getTags = exports.getTags = function getTags() {
    var dir = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

    return new Promise(function (resolve, reject) {
        (0, _simpleGit2.default)(dir).tags(function (err, tags) {
            if (err) {
                reject(new Error('No tags finded'));
            } else {
                resolve(tags);
            }
        });
    });
};

var getLastTag = exports.getLastTag = function getLastTag() {
    var dir = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

    return getTags(dir).then(function (tags) {
        return tags.all.sort(function (a, b) {
            return parseInt(a) < parseInt(b) ? -1 : 1;
        }).pop();
    });
};

var addTag = exports.addTag = function addTag(tagname) {
    var dir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    return new Promise(function (resolve, reject) {
        if (typeof tagname === 'string' && tagname.length > 0 || typeof tagname === 'number') {
            (0, _simpleGit2.default)(dir).addTag(String(tagname), function (err, tags) {
                resolve(tags);
            });
        } else {
            reject(new Error('Invalid tag name'));
        }
    });
};