#!/usr/bin/env node
import {mkdir, getJsonFile, mv, createPath, deleteFolderRecursive} from './lib/common/file';
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
    '0.7.0.3'
];
const CONTENT_HTML5_ROOT = 'Content_HTML5/';
const PACKAGE_NAME = 'package.json';

const log = console.log;
const exec = child_process.execSync;



let sdkVersions = [];
let componentVersions = [];

log('made directory');
mkdir(CONTENT_HTML5_ROOT);

const authToken = 'a8b0472eaaa7ad806e6b3b0a7a048245e31b4a0e';
const org = 'stmath'

let cloneUrls = [];
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
        log('found urls: ' + result.length + ' total: ' + cloneUrls.length);
    } else {
        log('nothing found');
    }
}

// Iterate over all arena git repos
for (let iter = 0; iter < cloneUrls.length; iter++) {
    let gitUrl = cloneUrls[iter];
    if (gitUrl) {
        let name = gitUrl.split('mind-games-')[1].split('.git')[0];
        let dir = `game_bundles/${name}/`;

        log('Start Bundle: ' + name);
        mkdir(dir);
        log('Cloning directory: ' + gitUrl);
        let command = `git clone ${gitUrl} ./${dir}`;
        exec(command);
        // get the package json file
        let file = getJsonFile(`./${dir}${PACKAGE_NAME}`);
        // find out which sdk this arena uses
        let sdkVersion = getPkgField(file, 'jspm.dependencies.mind-sdk');
        log('SDK: ' + sdkVersion);
        if (sdkVersions.indexOf(sdkVersion) < 0) sdkVersions.push(sdkVersion);
        // find out which componen this arena uses
        let componentVersion = getPkgField(file, 'jspm.dependencies.mind-game-components');
        log('Components: ' + componentVersion);
        if (componentVersions.indexOf(componentVersion) < 0) componentVersions.push(componentVersion);
        // do npm install
        log('Performing npm install');
        exec(`npm install`, {cwd: `./${dir}`});
        // do jspm install
        log('Performing jspm install');
        exec(`jspm install`, {cwd: `./${dir}`});

        if (SUPPORTED_VERSIONS.indexOf(componentVersions) < 0) {
            log('SUPPORT component less bundle');
            log('Remove previous install of mind-sdk and mind-game-components');
            exec('jspm uninstall mind-sdk mind-game-components', {cwd: `./${dir}`});
            log('Install mind-sdk');
            exec('jspm install mind:mind-sdk@0.6.5', {cwd: `./${dir}`});
            log('Install mind-game-components');
            exec('jspm install mind:mind-game-components@0.6.5', {cwd: `./${dir}`});
        }

        // do build process
        log('Building ' + name);
        // TODO: Update the mindbuild process
        // accept a --gzip option to force the js file into a zipped file
        // additionally, update manfiest to write file size
        // additionally, add an option to gzip with an override and without an override (leave both in place)
        // TODO: Automatically zip the tar file
        exec(`mindbuild -m`, {cwd: `./${dir}`});

        // move directories
        let folder = createPath(CONTENT_HTML5_ROOT, name, 'version');
        mkdir(`Content_HTML5/${name}/`);
        mkdir(`Content_HTML5/${name}/version/`);

        log('Moving bundled files to ' + folder);
        let bundlejs = name + '.js';
        let bundletar = name + '.tar';
        let manifest = 'manifest.json';
        mv(createPath(dir, 'dist', bundlejs), createPath(folder, bundlejs));
        mv(createPath(dir, 'dist', bundletar), createPath(folder, bundletar));
        mv(createPath(dir, 'dist', manifest), createPath(folder, manifest));

        deleteFolderRecursive(dir);
    }
}

const componentsRepo = 'https://bwalters@bitbucket.mindresearch.org/scm/cs/mind-game-components.git';
log ('**** REQUIRED COMPONENTS ****');
for (let compIter = 0; compIter < componentVersions.length; compIter++) {
    let componentVersion = componentVersions[compIter];
    console.log(componentVersion);
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
for (let sdkIter = 0; sdkIter < sdkVersions.length; sdkIter++) {
    let sdkVersion = sdkVersions[sdkIter];
    console.log(sdkVersion);
}

// TODO - build each version of the sdk
// TODO - build each version of the component