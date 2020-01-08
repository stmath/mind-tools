import FS from 'fs';
import nectar from 'nectar';
import child_process from 'child_process';
import os from 'os';
import {getJsonFile, createPath, mkdir} from './common/file';
import {upload} from './s3';
import moment from 'moment-timezone';
import path from 'path';

/**
 * Bundle assets defined in mind.bundle-assets.assets = [] & mind.bundle-assets.output = ''
 * Returns a promise that end with true if succeed.
 *
 * @param {String} dest: Destination directory
 * @returns {Object<Promise>}
 */
export const bundleAssets = (dest) => {
    const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    let ret = Promise.resolve(true);
    if (assets && output && assets.length > 0 && output.length > 0) {
        const destPath = createPath(dest, output);
        const mkdirRes = mkdir(destPath.substr(0, destPath.lastIndexOf('/')));
        if (mkdirRes.ok) {
            ret = nectar(assets, destPath)
            .then(_ => true)
            .catch(error => {
                logFn(`Error on bundle assets ${error.message}`);
                return false;
            });
        } else {
            logFn(`Error on bundle assets. Can't create a ${destPath} directory. Fail with message: ${mkdirRes.message}`);
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
export const bundleGame = (version, dest, hash) => {
    let name = getPackageJsonField('mind.name');
    let ret = false;
    if (typeof name === 'string' && name.length > 0) {
        const workingDirectory = getPackageJsonField('jspm.directories.lib');
        if (workingDirectory) {
            const spawn = child_process.spawnSync;
            // Exec the global jspm command instead of calling a library function, so we make sure of being using the correct jspm version.
            const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
            const modulePath = createPath(workingDirectory, name, name);
            logFn(`Executing: jspm bundle ${modulePath} - mind-sdk/**/* ${name}.js.`);
            logFn(`Writing bundle ./${name}.js`);

            let bundleCommand = `${modulePath} - mind-sdk/**/* `;
            
            // component bundling is the default behavior on games using minComponentBundles
            let useComponentBundles = getPackageJsonField('mind.useComponentBundles');
            if (useComponentBundles === undefined) {
                // if not explicitly opting-in to component bundles, then check component version
                // as of 0.7.0 arenas will use component bundles by default
                const minComponentBundles = '0.7.0';
                let componentVersion = getPackageJsonField('jspm.dependencies.mind-game-components');
                useComponentBundles = isVersionAfter(componentVersion, minComponentBundles);
            }

            // subtract component bundles
            if (useComponentBundles) {
                bundleCommand = bundleCommand + ' - mind-game-components/**/* ';
                logFn(`Writing bundle without components`);
            }

            const res = spawn(command, ['bundle', bundleCommand, `${dest+name}.js`], {stdio: "inherit"});
            if (!res.error && res.status === 0) {
                logFn(`Writing manifest ./manifest.json`);
                writeManifest(name, modulePath, version, dest, hash, useComponentBundles);
                ret = true;
            } else {
                logFn(`Error: Jspm finish with status ${res.status} and error: ${res.error}.`);
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
 * Check if the given semVer is after the targeted semVer
 * This is used to check if an arena's component version is after the 0.7.0 limit
 * @param {String} testVersion The component version to check 
 * @param {String} targetVersion The component version to target
 */
const isVersionAfter = (testVersion, targetVersion) => {
    let testParts = testVersion.split('.');
    logFn('Test version ' + testVersion);
    let targetParts = targetVersion.split('.');
    // iterate over all parts of the testVersion to compare against target
    for (let iter = 0; iter < testParts.length; iter++) {
        logFn('Check test version ' + testParts[iter]);
        // validate that the test is a numeric value
        if (isNaN(testParts[iter])) {
            logFn('failed is NaN');
            return false;
        }
        // if there is no matching target version,
        // then we assume the components is later
        let targetPart = targetParts[iter];
        if (!targetPart || isNaN(targetPart)) {
            logFn('target check ended ' + targetPart);
            return true;
        }
        // if the test part is greater than the target part, then return false
        if (targetPart > testParts[iter]) {
            logFn(`failed test: Target-${targetPart} Test-${testParts[iter]}`);
            return false;
        }
    }
    return true;
}

/**
 * Used for mind-game-components repo. Bundle each available component and its assets
 * @param {String} version the string to apply to the compiled version of these bundles
 */
export const bundleComponents = (version, minify = true) => {
    let success = true;
    // determine all the components that can be bundled from this repo
    const componentsToBundle = getPackageJsonField('mind.componentBundles');
    const bundleRoot = getPackageJsonField('mind.bundleRoot');
    // define properties that will be re-used for each component bundle process
    const spawn = child_process.spawnSync;
    const command = (os.platform() === 'win32') ? 'jspm.cmd' : 'jspm';
    const subSDK = ' - mind-sdk/**/* ';

    // Setup iteration over all components that will be bundled
    let componentNames = Object.keys(componentsToBundle);
    let bundledAssets = [];
    let previousComponents = [];

    if(minify) logFn('Bundle files will be minified');

    for (let iter = 0; iter < componentNames.length; iter++) {
        let name = componentNames[iter];
        let componentInfo = componentsToBundle[name];
        
        if (componentInfo.dist) {
            logFn('Bundling component: ' + name);
            // generate properties used by the bundling command
            const modulePath = componentInfo.dist;                                                  // the location of the code that will be compiled
            // create a string that defines which code should be removed from the component bundling
            // this can be used to remove some non-component specific code that may exist in the same folder
            let subtractComponents = '';
            let libToRemove = componentInfo.sub || [];
            libToRemove = libToRemove.concat(previousComponents);
            if (libToRemove) {
                for (let i = 0; i < libToRemove.length; i++) {
                    subtractComponents += ` - ${libToRemove[i]} `;
                }
            }
    
            let plusComponents = '';
            let libToAdd = componentInfo.plus;
            if (libToAdd) {
                for (let i = 0; i < libToAdd.length; i++) {
                    plusComponents += ` + ${libToAdd[i]} `;
                }
            }
    
            const bundleCommand = `${modulePath} ${plusComponents} ${subSDK} ${subtractComponents} `                           // composite command for bundling the component
            const bundleResult = createPath(bundleRoot, version, componentInfo.bundleRoot, `${name}.js`);
            // apply extra parameters to the bundle call as necessary
            let extraParams = [];
            extraParams.push('--inject');
            extraParams.push('--skip-source-maps');
            if(minify) extraParams.push('--minify');
            // perform the bundle command
            const res = spawn(command, ['bundle', bundleCommand, bundleResult].concat(extraParams), {stdio: "inherit"});
            // check the result of the bundling
            if (!res.error && res.status === 0) {
                logFn(`Bundled component to: ${bundleResult}`);
            } else {
                // if there was an error, break from the bundling loop
                logFn(`Error writing bundle: ${bundleResult}`);
                success = false;
                break;
            }

            // remove core components from all subsequent components
            if (componentInfo.name === "CoreComponents") {
                previousComponents.push(bundleResult);
            }
        } else {
            logFn('Skipping code bundle for component: ' + name);
            const componentFolder = createPath(bundleRoot, version, componentInfo.bundleRoot);
            FS.mkdirSync(componentFolder)
        }
        
        // bundle the assets that are related to this component as signified by properties in the package.json
        let assetBundle = bundleComponentAssets(componentInfo, version);
        if (assetBundle) bundledAssets.push(assetBundle);
    }
    // if every component bundled properly, then generate a json that holds neede configuration info
    if (success) writeComponentConfig(version, bundledAssets);
    // return the result of the component bundling
    return success;
};

const bundleComponentAssets = (componentInfo, version) => {
    // check if this component requires asset bundling
    let assetsSrc = componentInfo.assets;
    if (!assetsSrc) return;
    // define the path from which the assets will be bundled
    let relativeSrc = componentInfo.src;
    let assetsDirectory = path.resolve(relativeSrc);
    // define where the bundled assets will be stored
    const componentsDir = getPackageJsonField('mind.bundleRoot');
    const bundleDir =  createPath(componentsDir, version, componentInfo.bundleRoot);   // should be 'components/{version}/{componentName}/'
    const bundlePath = createPath(bundleDir, `${componentInfo.name}.tar`);
    const bundleName = path.resolve(`./${bundlePath}`);

    // call to nectar to bundle the assets
    nectar(assetsSrc, bundleName, {cwd: assetsDirectory});
    return {
        name: componentInfo.name,
        relativePath: componentInfo.relativeAssetPath,
        bundleRoot: `/${bundleDir}`
    };
};

const writeComponentConfig = (version, bundledAssets) => {
    let componentMappingJSON = compileAssetMappingJSON(bundledAssets);            
    let compositeJSON = JSON.stringify(componentMappingJSON);   
    let bundlesStr = extractBundlesFromConfig();
    // compose the bundleJSONStr - and ready it to be written into the componentsConfig.json file
    let bundleJSONStr = `{
        "componentSettings": ${compositeJSON},
        "systemJSConfig": {
            ${bundlesStr}
        }
    }`;

    let bundleRoot = getPackageJsonField('mind.bundleRoot');
    let configName = getPackageJsonField('mind.configName');
    let path = createPath(bundleRoot, version, configName);
    FS.writeFileSync(path, bundleJSONStr);
}

const extractBundlesFromConfig = () => {
    // This function will read the config.js for the components and extract the "bundles" property that was created via the --inject command
    let filePath = path.join("./", 'config.js');
    let data = FS.readFileSync(filePath, {encoding: 'utf-8'} );
    let bundleIdx = data.indexOf('bundles: {');
    let subStr = data.slice(bundleIdx);
    let endIdx = subStr.indexOf('}');
    let bundlesStr = data.slice(bundleIdx - 1, bundleIdx + endIdx + 1);
    return bundlesStr.replace('bundles', '"bundles"');
}

const extractFromConfigJS = () => {
    // This function will read the config.js and extract all setting inside the config parentheses "config(...)"
    let filePath = path.join("./", 'config.js');
    let data = FS.readFileSync(filePath, {encoding: 'utf-8'} );
    let bundleIdx = data.indexOf(`(`) + 1;
    let subStr = data.slice(bundleIdx);
    let endIdx = subStr.indexOf(')');
    let bundlesStr = data.slice(bundleIdx, bundleIdx + endIdx);
    bundlesStr = bundlesStr.replace(/([{,])(\s*)([A-Za-z0-9_\-]+?)\s*:/g, '$1"$3":'); // add double quotes to keys
    return bundlesStr || '{}';
}

export const uploadBundleComponents = (version) => {
    let promise;
    let uploadPromises = [];
    // determine all the components that can be bundled from this repo
    const componentsToBundle = getPackageJsonField('mind.componentBundles');
    // define properties that will be re-used for each component bundle process
    let [s3folder, s3bucket] = [getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder, getPackageJsonField('mind.aws.s3bucket') || DEFAULTS.s3bucket];
    // define the root folder of the components bundles within the s3 bucket
    let componentRoot = 'components/'
    // get the properties for the config on the component bundles
    let configName = getPackageJsonField('mind.configName');
    let configPath = createPath(componentRoot, version, configName);
    let targetConfigPath = createPath(s3folder, componentRoot, version, configName);
    // attempt to upload the config json to s3
    let configJSONPromise = upload(configPath, targetConfigPath, s3bucket)
    uploadPromises.push(configJSONPromise);

    // Setup iteration over all components that will be bundled
    let componentNames = Object.keys(componentsToBundle);
    for (let iter = 0; iter < componentNames.length; iter++) {
        let bundleName = componentNames[iter];
        let componentInfo = componentsToBundle[bundleName];
        // generate the path to store the js and tar file for the components
        const bundleKey = createPath(s3folder, componentRoot, version, componentInfo.bundleRoot, `${bundleName}.js`);
        // send the component's bundle js file up
        const bundlePath = createPath(componentRoot, version, componentInfo.bundleRoot, `${bundleName}.js`);
        promise = upload(bundlePath, bundleKey, s3bucket)
        .then(success => {
            if (success) {
                let assetsSrc = componentInfo.assets;
                if (assetsSrc) {
                    const tarKey = createPath(s3folder, componentRoot, version, componentInfo.bundleRoot, `${bundleName}.tar`);
                    return upload(`${bundleName}.tar`, tarKey, s3bucket);
                }
            }
        });
        uploadPromises.push(promise);
    }
    return Promise.all(uploadPromises);
}

/**
 * Generate a JSON with property - "assetSettings" that is defined by a set of properties that maps
 * a given component bundle to a relative asset url for the component's bundled assets
 * Note: This mapping is stored in the package.json
 * @param {*} bundledAssets An array of Object that include component name and relative source for component assets
 */
const compileAssetMappingJSON = (bundledAssets) => {
    let assetMapping = {};
    for(let i = 0; i < bundledAssets.length; i++) {
        let assetInfo = bundledAssets[i];
        assetMapping[assetInfo.name] = {
            relativePath: assetInfo.relativePath,
            bundleRoot: assetInfo.bundleRoot
        };
    }
    // return the object for assetSettings that will be read while unbundling component assets
    return {
        assetSettings: assetMapping
    };
}

/**
 * Set log function. E.g: console.log
 *
 * @param {object<function>} handlerFn: Function.
 * @returns
 */
export const setLogHandler = handlerFn => {
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
export const uploadBundle = (version, bundleName = undefined) => {
    bundleName = bundleName || getPackageJsonField('mind.name');
    let promise;
    if (typeof bundleName === 'string' && bundleName.length > 0) {
        let [s3folder, s3bucket] = [getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder,
                                getPackageJsonField('mind.aws.s3bucket') || DEFAULTS.s3bucket];

        const bundleKey = createPath(s3folder, bundleName, version, `${bundleName}.js`);
        const manifestKey = createPath(s3folder, bundleName, version, 'manifest.json');

        logFn(`Uploading bundle to S3: bucket: ${s3bucket}, key: ${bundleKey}`);
        promise = upload(`${bundleName}.js`, bundleKey, s3bucket)
            .then(success => {
                logFn(`Uploading manifest to S3: bucket: ${s3bucket}, key: ${manifestKey}`);
                if (success) {
                    return upload(`manifest.json`, manifestKey, s3bucket);
                }
            });
    } else {
        promise = Promise.reject(new Error('Invalid bundle name'));
    }
    return promise;
}

/**
 * Get Bundle Name
 *
 * @returns {string}: Bundle name.
 */
export const getBundleName = () => getPackageJsonField('mind.name');


const writeManifest = (name, arenakey, version, dest, hash, useComponentBundles) => {
    const sdkVersion = getTagFromMapString(getConfigJsField('map.mind-sdk')) // getPackageJsonField('jspm.dependencies.mind-sdk');
    const folder = getPackageJsonField('mind.aws.s3folder') || DEFAULTS.s3folder;
    const [assets, output] = getPackageJsonFields('mind.bundle-assets', ['assets', 'output']);
    const webAppOptions = getPackageJsonField('mind.webAppOptions');
    const testHarnessOptions = getPackageJsonField('mind.testHarnessOptions');
    const overrides = getPackageJsonField('mind.overrides');
    const buildDate = moment().tz('America/Los_Angeles').format();
    const componentVersion = getPackageJsonField('jspm.dependencies.mind-game-components');
    const manifest = {
        'module': name,
        'arenaKey': arenakey,
        'version' : version,
        'buildDate': buildDate,
        'commit': hash,
        'sdkBundleFile': `/pilot/sdk/mind-sdk-${sdkVersion}.js`,
        'gameBundleFile': createPath('/', folder, name, version, name + '.js'),
        'assetsBaseUrl': folder,
        'systemJsConfig': {
            'map': {
                'mind-sdk': `mind:mind-sdk@${sdkVersion}`
            }
        }
    };
    if (assets && output && assets.length > 0 && output.length > 0) {
        manifest.assetsBundleFile = createPath('/', name, version, output+'.gz');
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
    if (useComponentBundles) {
        manifest.componentsConfigUrl = `${DEFAULTS.s3folder}/components/${componentVersion}/ComponentsConfig.json`;
    }

    try {
        FS.writeFileSync(`${dest}manifest.json`, JSON.stringify(manifest, null, 2));
    } catch (e) {
        logFn(`Error writing manifest: ${e}`);
    }

};

const getFieldFromObj = (obj, field) => {
    let retObj = obj;
	if (typeof field === 'string' && field.length > 0) {
		field
            .split('.')
            .forEach(p => {
                retObj = retObj && retObj[p];
            });
    }
	return retObj;
}

const getPackageJsonField = field => {
	if (!getPackageJsonField.cache) {
		getPackageJsonField.cache = getJsonFile('package.json');
	}
    let retObj = getPackageJsonField.cache.content;
	if (typeof field === 'string' && field.length > 0) {
		field
            .split('.')
            .forEach(p => {
                retObj = retObj && retObj[p];
            });
    }
	return retObj;
};

const getTagFromMapString = (mapString = '') => {
    let out;

    if (typeof mapString === 'string') {
        let splitArr = mapString.split('@');
        if (splitArr.length > 1) {
            out = splitArr[1];
        }
    }

    return out;
}

const getConfigJsField = field => {
    let outVal;
    try {
        let configJSON = extractFromConfigJS();
        let configObj = JSON.parse(`${configJSON}`);
        outVal = getFieldFromObj(configObj, field);
    } catch (e) { console.warn(e); }

    return outVal;
}

const getPackageJsonFields = (ns = '', fields = undefined) => {
	let ret = [];
	if (typeof ns !== 'string') {
		ns = '';
	}
	if (Array.isArray(fields)) {
        ret = fields
            .filter(f => typeof f === 'string' && f.length > 0)
            .map(f => getPackageJsonField([ns, f].join('.')));
	}
	return ret;
};

let logFn = (_) => {};

const DEFAULTS = {
    s3bucket: 'mri-game-conversion',
    s3folder: '/Content_HTML5'
}