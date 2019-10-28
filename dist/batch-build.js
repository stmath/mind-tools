#!/usr/bin/env node
'use strict';

var _file = require('./lib/common/file');

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _bundle = require('./lib/bundle');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SUPPORTED_VERSIONS = ['0.6.0.3', '0.6.0.7', '0.6.0.13', '0.6.3.5', '0.6.5', '0.6.5.1', '0.7.0', '0.7.0.1', '0.7.0.2', '0.7.0.3'];
var CONTENT_HTML5_ROOT = 'Content_HTML5/';
var PACKAGE_NAME = 'package.json';

var log = console.log;
var exec = _child_process2.default.execSync;

var sdkVersions = [];
var componentVersions = [];

log('made directory');
(0, _file.mkdir)(CONTENT_HTML5_ROOT);

var authToken = 'a8b0472eaaa7ad806e6b3b0a7a048245e31b4a0e';
var org = 'stmath';

var cloneUrls = [];
// TODO: the github api is capped to 100 entries per page.
// to get all pages with the command line we need to call multiple times.
// rather than hard-coding MAX_PAGE, it should loop unitl the resulting file is almost empty
var page = 1;
var MAX_PAGE = 5;
for (page; page < MAX_PAGE; page++) {
    var outputFile = 'text' + page + '.txt';
    // let getReposCommand = `curl "https://api.github.com/orgs/${org}/repos?access_token=${authToken}&per_page=100&page=${page}" --output ${outputFile}`; 
    // exec(getReposCommand);
    var data = _fs2.default.readFileSync(outputFile, { encoding: 'utf-8' });

    var regex = /https:\/\/github.com\/stmath\/mind-games-\w+.git/g;
    var result = data.match(regex);
    if (result) {
        cloneUrls = cloneUrls.concat(result);
        log('found urls: ' + result.length + ' total: ' + cloneUrls.length);
    } else {
        log('nothing found');
    }
}

// Iterate over all arena git repos
for (var iter = 0; iter < cloneUrls.length; iter++) {
    var gitUrl = cloneUrls[iter];
    if (gitUrl) {
        var name = gitUrl.split('mind-games-')[1].split('.git')[0];
        var dir = 'game_bundles/' + name + '/';

        log('Start Bundle: ' + name);
        (0, _file.mkdir)(dir);
        log('Cloning directory: ' + gitUrl);
        var command = 'git clone ' + gitUrl + ' ./' + dir;
        exec(command);
        // get the package json file
        var file = (0, _file.getJsonFile)('./' + dir + PACKAGE_NAME);
        // find out which sdk this arena uses
        var sdkVersion = (0, _bundle.getPkgField)(file, 'jspm.dependencies.mind-sdk');
        log('SDK: ' + sdkVersion);
        if (sdkVersions.indexOf(sdkVersion) < 0) sdkVersions.push(sdkVersion);
        // find out which componen this arena uses
        var componentVersion = (0, _bundle.getPkgField)(file, 'jspm.dependencies.mind-game-components');
        log('Components: ' + componentVersion);
        if (componentVersions.indexOf(componentVersion) < 0) componentVersions.push(componentVersion);
        // do npm install
        log('Performing npm install');
        exec('npm install', { cwd: './' + dir });
        // do jspm install
        log('Performing jspm install');
        exec('jspm install', { cwd: './' + dir });

        if (SUPPORTED_VERSIONS.indexOf(componentVersions) < 0) {
            log('SUPPORT component less bundle');
            log('Remove previous install of mind-sdk and mind-game-components');
            exec('jspm uninstall mind-sdk mind-game-components', { cwd: './' + dir });
            log('Install mind-sdk');
            exec('jspm install mind:mind-sdk@0.6.5', { cwd: './' + dir });
            log('Install mind-game-components');
            exec('jspm install mind:mind-game-components@0.6.5', { cwd: './' + dir });
        }

        // do build process
        log('Building ' + name);
        // TODO: Update the mindbuild process
        // accept a --gzip option to force the js file into a zipped file
        // additionally, update manfiest to write file size
        // additionally, add an option to gzip with an override and without an override (leave both in place)
        // TODO: Automatically zip the tar file
        exec('mindbuild -m', { cwd: './' + dir });

        // move directories
        var folder = (0, _file.createPath)(CONTENT_HTML5_ROOT, name, 'version');
        (0, _file.mkdir)('Content_HTML5/' + name + '/');
        (0, _file.mkdir)('Content_HTML5/' + name + '/version/');

        log('Moving bundled files to ' + folder);
        var bundlejs = name + '.js';
        var bundletar = name + '.tar';
        var manifest = 'manifest.json';
        (0, _file.mv)((0, _file.createPath)(dir, 'dist', bundlejs), (0, _file.createPath)(folder, bundlejs));
        (0, _file.mv)((0, _file.createPath)(dir, 'dist', bundletar), (0, _file.createPath)(folder, bundletar));
        (0, _file.mv)((0, _file.createPath)(dir, 'dist', manifest), (0, _file.createPath)(folder, manifest));

        (0, _file.deleteFolderRecursive)(dir);
    }
}

var componentsRepo = 'https://bwalters@bitbucket.mindresearch.org/scm/cs/mind-game-components.git';
log('**** REQUIRED COMPONENTS ****');
for (var compIter = 0; compIter < componentVersions.length; compIter++) {
    var _componentVersion = componentVersions[compIter];
    console.log(_componentVersion);
    /**
    let directory = `components/${componentVersion}`;
    mkdir(directory);
    log('checkout branch: ' + componentVersion);
    let command = `git clone --branch ${componentVersion} ${componentsRepo} ./${directory}`;
    exec(command);
    log('testing component repo');
    let testCommand = `component-bundle -ts`;
    let res = exec(testCommand, {cwd: `${directory}`});
    if (!res.error && res.status === 0) {
        log('preparing to bundle components');
        let bundleCommand = `component-bundle --version ${componentVersion} --minify`;
        exec(bundleCommand, {cwd: `./${directory}`});
    } else {
        log('failed building component bundles: ' + res.error);
    }
    **/
}

log('**** REQUIRED SDK VERSIONS ****');
for (var sdkIter = 0; sdkIter < sdkVersions.length; sdkIter++) {
    var _sdkVersion = sdkVersions[sdkIter];
    console.log(_sdkVersion);
}

// TODO - build each version of the sdk
// TODO - build each version of the component