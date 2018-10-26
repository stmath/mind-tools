import FS from 'fs';

/**
 * Get content Type from file name
 *
 * @param {string} fileName: File name.
 * @returns {string}: Content type
 */
export const contentType = fileName => {
	let contentType;
	if (typeof fileName !== 'string') {
		fileName = '';
	}
	const contentTypes = [
		['', 'application/octet-stream'],
		['.html', 'text/html'],
		['.css', 'text/css'],
		['.json', 'application/json'],
		['.js', 'application/x-javascript'],
		['.png', 'image/png'],
		['.jpg', 'image/jpg'],
		['.svg', 'image/svg+xml']
	];

	let type = contentTypes.pop();
	const name = fileName.toLowerCase()
	do {
		if (name.endsWith(type[0])) {
			contentType = type[1];
		}
		type = contentTypes.pop();
	} while (contentType !== undefined);

	return contentType;
}

/**
 * Read and parse json file.
 * {
 *      content: {...} or undefined
 *      error: error string or undefined
 * }
 *
 * @param {string} jsonFile: File name.
 * @returns {object}:
 */
export const getJsonFile = (jsonFile) => {
	let ret = { content: undefined, error: undefined };
	let rawData;
	if (typeof jsonFile === 'string' && jsonFile.length > 0) {
		try {
			rawData = FS.readFileSync(jsonFile, 'utf8');
		} catch (error) {
			ret.error = `Error: Fail to reading package.json. Exception: ${error}`;
		}
		if (rawData) {
			try {
				ret.content = JSON.parse(rawData);
			} catch (error) {
				ret.error = `Error: Can't parse json format. Exception: ${error}`;
			}
		}
	} else {
		ret.error = 'Error: Invalid file name.';
	}


	return ret;
}

export const createPath = (...args) => {
    const prefix = (typeof args[0] === 'string' && args[0].startsWith('/')) ? '/' : '';
    return prefix + args
        .filter(a => ['string', 'number'].includes(typeof a) && a !== '/')
        .map(a => String(a))
        .map(a => a.split('/').filter(e => e.length > 0).join('/')) // Remove extra /
        .join('/');
}