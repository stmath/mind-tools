#!/usr/bin/env node
import {mkdir, getJsonFile, mv, createPath, deleteFolderRecursive, fileSize} from './lib/common/file';
import child_process from 'child_process';
import {getPkgField} from './lib/bundle';
import FS from 'fs';


const SUPPORTED_VERSIONS = [
    '0.6.0.3',
    '0.6.0.7',
    '0.6.0.13',
    '0.6.3.5',
    '0.6.5',
    '0.6.5.1',
    '0.7.0',
    '0.7.0.1',
    '0.7.0.2',
    '0.7.0.3',
    '0.7.0.4',
    '0.7.0.5'
];

const CONTENT_HTML5_ROOT = 'Content_HTML5/';
const PACKAGE_NAME = 'package.json';

const log = console.log;
const exec = child_process.execSync;

let sdkVersions = [];
let componentVersions = [];
let totalCompressedSize = 0;
let totalNonCompressedSize = 0;

log('made directory');
mkdir(CONTENT_HTML5_ROOT);

const authToken = 'a8b0472eaaa7ad806e6b3b0a7a048245e31b4a0e';
const org = 'stmath'

let cloneUrls = [];
let failedArenas = [];
// TODO: the github api is capped to 100 entries per page.
// to get all pages with the command line we need to call multiple times.
// rather than hard-coding MAX_PAGE, it should loop unitl the resulting file is almost empty
let page = 1;
const MAX_PAGE = 5;
for (page; page < MAX_PAGE; page++){
    let outputFile = `text${page}.txt`;
    // let getReposCommand = `curl "https://api.github.com/orgs/${org}/repos?access_token=${authToken}&per_page=100&page=${page}" --output ${outputFile}`; 
    // exec(getReposCommand);
    let data = FS.readFileSync(outputFile, {encoding: 'utf-8'});

    var regex = /https:\/\/github.com\/stmath\/mind-games-\w+.git/g;
    let result = data.match(regex);
    if (result) {
        cloneUrls = cloneUrls.concat(result);
    }
}
log(`Total Number of arenas: ${cloneUrls.length}`);


// Iterate over all arena git repos
let start = 0;
let count = cloneUrls.length;
for (let iter = start; iter < start+count; iter++) {
    let gitUrl = cloneUrls[iter];
    if (gitUrl) {
        // get the name of the arena related to this github url
        let name = gitUrl.split('mind-games-')[1].split('.git')[0];
        // Ignore the ExampleGame - it doesn't count towards gen6 content
        if (name === 'ExampleGame') {
            console.log('ignore Example Game');
            continue;
        }

        let dir = `game_bundles/${name}/`;
        log('Start Bundle: ' + name);
        let attemptCount = 0;
        let totalCount = 3;
        let success = false;
        while (!success && attemptCount < totalCount) {
            mkdir(dir);
            try {
                let command = `git clone ${gitUrl} ./${dir}`;
                exec(command);
                // get the package json file
                let file = getJsonFile(`./${dir}${PACKAGE_NAME}`);
                // find out which sdk this arena uses
                let sdkVersion = getPkgField(file, 'jspm.dependencies.mind-sdk');
                if (sdkVersions.indexOf(sdkVersion) < 0) sdkVersions.push(sdkVersion);
                // find out which componen this arena uses
                let componentVersion = getPkgField(file, 'jspm.dependencies.mind-game-components');
                if (componentVersions.indexOf(componentVersion) < 0) componentVersions.push(componentVersion);
                log(`mind-sdk@${sdkVersion} mind-game-components@${componentVersion}`);
                
                log('Install npm and jspm dependencies');
                exec(`npm install`, {cwd: `./${dir}`});
                exec(`jspm install`, {cwd: `./${dir}`});

                if (SUPPORTED_VERSIONS.indexOf(componentVersion) < 0) {
                    log('COMPONENT-BUNDLES - installed version of components not supported');
                    log('Installing mind-sdk@0.6.5 mind-game-components@0.6.5');
                    exec('jspm uninstall mind-sdk mind-game-components', {cwd: `./${dir}`});
                    exec('jspm install mind:mind-sdk@0.6.5', {cwd: `./${dir}`});
                    exec('jspm install mind:mind-game-components@0.6.5', {cwd: `./${dir}`});
                }

                // do build process
                log('Building ' + name);
                exec(`mindbuild -mg`, {cwd: `./${dir}`});

                // move directories
                let folder = createPath(CONTENT_HTML5_ROOT, name, 'version');
                mkdir(`Content_HTML5/${name}/`);
                mkdir(`Content_HTML5/${name}/version/`);

                log('Moving bundled files to ' + folder);
                // move the non-compressed bundle file
                let bundlejs = name + '.js';
                let bundlejsTarget = createPath(folder, bundlejs);
                mv(createPath(dir, 'dist', bundlejs), bundlejsTarget);
                let bundleJsFileSize = fileSize(bundlejsTarget);
                // move the comporessed bundle file
                let bundlejsgz = name + '.js.gz';
                let bundlejsgzTarget = createPath(folder, bundlejsgz);
                mv(createPath(dir, 'dist', bundlejsgz), bundlejsgzTarget);
                let bundleJsgzFileSize = fileSize(bundlejsgzTarget);
                // move the compressed tar file
                let bundletar = name + '.tar.gz';
                let bundletarTarget = createPath(folder, bundletar);
                mv(createPath(dir, 'dist', bundletar), bundletarTarget);
                let bundleTarFileSize = fileSize(bundletarTarget);
                // move the manifest json
                let manifest = 'manifest.json';
                let manifestTarget = createPath(folder, manifest);
                mv(createPath(dir, 'dist', manifest), manifestTarget);
                let manifestFileSize = fileSize(manifestTarget);

                let arenaCompressedSize = bundleJsgzFileSize + bundleTarFileSize + manifestFileSize;
                let nonCompressedScript = bundleJsFileSize + bundleTarFileSize + manifestFileSize;

                totalCompressedSize += arenaCompressedSize;
                totalNonCompressedSize += nonCompressedScript;

                log(`${name}: Compressed: ${arenaCompressedSize}`);

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
                deleteFolderRecursive(dir);
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
let totalComponentBundleSize = 0;
let averateComponentBundleSize = 0;

const componentsRepo = 'https://bwalters@bitbucket.mindresearch.org/scm/cs/mind-game-components.git';
log ('**** REQUIRED COMPONENTS ****');
for (let compIter = 0; compIter < componentVersions.length; compIter++) {
    let componentVersion = componentVersions[compIter];
    console.log(componentVersion);
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
for (let sdkIter = 0; sdkIter < sdkVersions.length; sdkIter++) {
    let sdkVersion = sdkVersions[sdkIter];
    console.log(sdkVersion);
}

log();
log();
log(`******Arena RESULTS*****`);
log(`Content size (Non compressed scripts): ${totalNonCompressedSize}`);
log(`Content size (compressed scripts): ${totalCompressedSize}`);
log(`Failed arenas (count): ${failedArenas.length}`);
for (let iter = 0; iter < failedArenas.length; iter++) {
    log(failedArenas[iter]);
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