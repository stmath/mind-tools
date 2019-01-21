import {getJsonFile} from './common/file';

/**
 * runs tests for this game
 *
 * @returns
 */
export const testGame = () => {
    const config = getPackageJsonField('mind');
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