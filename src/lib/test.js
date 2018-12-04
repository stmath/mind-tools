import {getJsonFile} from './common/file';

/**
 * runs tests for this game
 *
 * @returns
 */
export const testGame = () => {
    const fakTestResult = getPackageJsonField('mind.fakTestResult');
    return fakTestResult;
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