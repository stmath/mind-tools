import git from 'simple-git';
import child_process from 'child_process';

export const mostRecentTag = (dir = undefined) => {
    const command = 'git describe';
    const exec = child_process.execSync;
    const description = exec(command);
    return description;
}

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
                git(dir).pushTags('origin', () => {
                    resolve(tags);
                })
            });
        } else {
            reject(new Error('Invalid tag name'));
        }
    });
}

/**
 * Get last commit hash
 *
 * @param {*} [dir=undefined]: Working directory. Default current.
 * @returns
 */
export const getLastCommitHash = (dir = undefined) => {
    return new Promise((resolve, reject) => {
        git(dir).revparse(['HEAD', '--sq'],(err, hash) => {
            if (err) {
                resolve('');
            } else {
                resolve(hash.replace(/^\s+|\s+$/g, ''));
            }
        });
    });
}

