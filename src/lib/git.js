import git from 'simple-git';

/**
 * Get all git tags
 *
 * @param {*} [dir=undefined]: Working directory. Default current.
 * @returns
 */
export const getTags = (dir = undefined) => {
    return new Promise((resolve, reject) => {
        git(dir).tags((err, tags) => {
            if (err) {
                reject(new Error('No tags finded'));
            } else {
                resolve(tags);
            }
        });
    });
}

/**
 * Get last tag
 *
 * @param {*} [dir=undefined]: Working directory. Default current.
 * @returns
 */
export const getLastTag = (dir = undefined) => {
    return getTags(dir)
        .then(tags => tags.all.sort((a,b) => (parseInt(a) < parseInt(b)) ? -1 : 1).pop());
}

/**
 * Tag git branch.
 *
 * @param {string} [tagname]: Tag name.
 * @param {*} [dir=undefined]: Working directory. Default current.
 * @returns
 */
export const addTag = (tagname, dir = undefined) => {
    return new Promise((resolve, reject) => {
        if ((typeof tagname === 'string' && tagname.length > 0) || typeof tagname === 'number') {
            git(dir).addTag(String(tagname), (err, tags) => {
                resolve(tags);
            });
        } else {
            reject(new Error('Invalid tag name'));
        }
    });
}