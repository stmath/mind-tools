#!/usr/bin/env node
'use strict';

var _file = require('./lib/common/file');

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _bundle = require('./lib/bundle');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SUPPORTED_VERSIONS = ['0.6.0.3', '0.6.0.7', '0.6.0.13', '0.6.3.5', '0.6.5', '0.6.5.1', '0.7.0', '0.7.0.1', '0.7.0.2', '0.7.0.3', '0.7.0.4', '0.7.0.5'];

var CONTENT_HTML5_ROOT = 'Content_HTML5/';
var PACKAGE_NAME = 'package.json';

var log = console.log;
var exec = _child_process2.default.execSync;

var sdkVersions = [];
var componentVersions = [];
var totalCompressedSize = 0;
var totalNonCompressedSize = 0;

log('made directory');
(0, _file.mkdir)(CONTENT_HTML5_ROOT);

var authToken = 'a8b0472eaaa7ad806e6b3b0a7a048245e31b4a0e';
var org = 'stmath';

var cloneUrls = [];
var failedArenas = [];
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
    }
}
log('Total Number of arenas: ' + cloneUrls.length);

// Iterate over all arena git repos
var start = 0;
var count = cloneUrls.length;
for (var iter = start; iter < start + count; iter++) {
    var gitUrl = cloneUrls[iter];
    if (gitUrl) {
        // get the name of the arena related to this github url
        var name = gitUrl.split('mind-games-')[1].split('.git')[0];
        // Ignore the ExampleGame - it doesn't count towards gen6 content
        if (name === 'ExampleGame') {
            console.log('ignore Example Game');
            continue;
        }

        var dir = 'game_bundles/' + name + '/';
        log('Start Bundle: ' + name);
        var attemptCount = 0;
        var totalCount = 3;
        var success = false;
        while (!success && attemptCount < totalCount) {
            (0, _file.mkdir)(dir);
            try {
                var command = 'git clone ' + gitUrl + ' ./' + dir;
                exec(command);
                // get the package json file
                var file = (0, _file.getJsonFile)('./' + dir + PACKAGE_NAME);
                // find out which sdk this arena uses
                var sdkVersion = (0, _bundle.getPkgField)(file, 'jspm.dependencies.mind-sdk');
                if (sdkVersions.indexOf(sdkVersion) < 0) sdkVersions.push(sdkVersion);
                // find out which componen this arena uses
                var componentVersion = (0, _bundle.getPkgField)(file, 'jspm.dependencies.mind-game-components');
                if (componentVersions.indexOf(componentVersion) < 0) componentVersions.push(componentVersion);
                log('mind-sdk@' + sdkVersion + ' mind-game-components@' + componentVersion);

                log('Install npm and jspm dependencies');
                exec('npm install', { cwd: './' + dir });
                exec('jspm install', { cwd: './' + dir });

                if (SUPPORTED_VERSIONS.indexOf(componentVersion) < 0) {
                    log('COMPONENT-BUNDLES - installed version of components not supported');
                    log('Installing mind-sdk@0.6.5 mind-game-components@0.6.5');
                    exec('jspm uninstall mind-sdk mind-game-components', { cwd: './' + dir });
                    exec('jspm install mind:mind-sdk@0.6.5', { cwd: './' + dir });
                    exec('jspm install mind:mind-game-components@0.6.5', { cwd: './' + dir });
                }

                // do build process
                log('Building ' + name);
                exec('mindbuild -mg', { cwd: './' + dir });

                // move directories
                var folder = (0, _file.createPath)(CONTENT_HTML5_ROOT, name, 'version');
                (0, _file.mkdir)('Content_HTML5/' + name + '/');
                (0, _file.mkdir)('Content_HTML5/' + name + '/version/');

                log('Moving bundled files to ' + folder);
                // move the non-compressed bundle file
                var bundlejs = name + '.js';
                var bundlejsTarget = (0, _file.createPath)(folder, bundlejs);
                (0, _file.mv)((0, _file.createPath)(dir, 'dist', bundlejs), bundlejsTarget);
                var bundleJsFileSize = (0, _file.fileSize)(bundlejsTarget);
                // move the comporessed bundle file
                var bundlejsgz = name + '.js.gz';
                var bundlejsgzTarget = (0, _file.createPath)(folder, bundlejsgz);
                (0, _file.mv)((0, _file.createPath)(dir, 'dist', bundlejsgz), bundlejsgzTarget);
                var bundleJsgzFileSize = (0, _file.fileSize)(bundlejsgzTarget);
                // move the compressed tar file
                var bundletar = name + '.tar.gz';
                var bundletarTarget = (0, _file.createPath)(folder, bundletar);
                (0, _file.mv)((0, _file.createPath)(dir, 'dist', bundletar), bundletarTarget);
                var bundleTarFileSize = (0, _file.fileSize)(bundletarTarget);
                // move the manifest json
                var manifest = 'manifest.json';
                var manifestTarget = (0, _file.createPath)(folder, manifest);
                (0, _file.mv)((0, _file.createPath)(dir, 'dist', manifest), manifestTarget);
                var manifestFileSize = (0, _file.fileSize)(manifestTarget);

                var arenaCompressedSize = bundleJsgzFileSize + bundleTarFileSize + manifestFileSize;
                var nonCompressedScript = bundleJsFileSize + bundleTarFileSize + manifestFileSize;

                totalCompressedSize += arenaCompressedSize;
                totalNonCompressedSize += nonCompressedScript;

                log(name + ': Compressed: ' + arenaCompressedSize);

                success = true;
            } catch (e) {
                log(e);
                attemptCount++;
            }

            log('Finished arena bundle: ' + name);
            log('Arena Index: ' + iter);
            log('Current totalCompressedSize: ' + totalCompressedSize);
            log('Current totalNonCompressedSize: ' + totalNonCompressedSize);

            // clear the arena directory
            try {
                (0, _file.deleteFolderRecursive)(dir);
            } catch (e) {
                log('unable to clear working directory for arena');
                log(e);
            }
        }

        // was unable to build the arena after the threshold number of attempts
        if (attemptCount === totalCount) {
            log('failed to build arena: ' + name);
            failedArenas.push(name);
        }
    }
}

// TODO zip component tar files
var totalComponentBundleSize = 0;
var averateComponentBundleSize = 0;

var componentsRepo = 'https://bwalters@bitbucket.mindresearch.org/scm/cs/mind-game-components.git';
log('**** REQUIRED COMPONENTS ****');
for (var compIter = 0; compIter < componentVersions.length; compIter++) {
    var _componentVersion = componentVersions[compIter];
    console.log(_componentVersion);
}

/**
log ('**** COMPONENT BUNDLES ****');
for (let compIter = 0; compIter < SUPPORTED_VERSIONS.length; compIter++) {
    let componentVersion = SUPPORTED_VERSIONS[compIter];
    let directory = `components/${componentVersion}`;
    mkdir(directory);

    log('checkout branch: ' + componentVersion);
    let command = `git clone --branch ${componentVersion} ${componentsRepo} ./${directory}`;
    exec(command);

    log('Install npm and jspm dependencies');
    exec(`npm install`, {cwd: `./${directory}`});
    exec(`jspm install`, {cwd: `./${directory}`});
    
    let bundleCommand = `component-bundle --version ${componentVersion} --minify`;
    log(`Command: ${bundleCommand}`);
    exec(bundleCommand, {cwd: `./${directory}`});

    // let testCommand = `component-bundle -ts`;
    // let res = exec(testCommand, {cwd: `${directory}`});
    // log('result: ' + res);
    // if (!res.error && res.status === 0) {
    //     log('preparing to bundle components');
    //     let bundleCommand = `component-bundle --version ${componentVersion} --minify`;
    //     exec(bundleCommand, {cwd: `./${directory}`});
    // } else {
    //     log('failed building component bundles: ' + res.error);
    // }
}
averateComponentBundleSize = totalComponentBundleSize / SUPPORTED_VERSIONS.length;
let approximatedMissingSize = averateComponentBundleSize * (componentVersions.length - SUPPORTED_VERSIONS.length);
**/

log('**** REQUIRED SDK VERSIONS ****');
for (var sdkIter = 0; sdkIter < sdkVersions.length; sdkIter++) {
    var _sdkVersion = sdkVersions[sdkIter];
    console.log(_sdkVersion);
}

log();
log();
log('******Arena RESULTS*****');
log('Content size (Non compressed scripts): ' + totalNonCompressedSize);
log('Content size (compressed scripts): ' + totalCompressedSize);
log('Failed arenas (count): ' + failedArenas.length);
for (var _iter = 0; _iter < failedArenas.length; _iter++) {
    log(failedArenas[_iter]);
}

/**
log();
log();
log(`******Component Results***`);
log(`Total number of components releases in use: ${componentVersions.length}`);
log(`Total number of component releases bundled: ${SUPPORTED_VERSIONS.length}`);
log(`Approximate size of component bundles: ${totalComponentBundleSize + averateComponentBundleSize}`);
log();
log();
log(`******SDK Results****`);
log(`Total number of components releases in use: ${componentVersions.length}`);
log(`Total number of component releases bundled: ${SUPPORTED_VERSIONS.length}`);
log(`Approximate size of component bundles: ${totalComponentBundleSize + averateComponentBundleSize}`);

**/

// TODO - build each version of the sdk
// TODO - build each version of the component