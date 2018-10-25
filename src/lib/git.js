import git from 'simple-git';

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

export const getLastTag = (dir = undefined) => {
    return getTags(dir).then(tags => tags.latest);
}

export const addTag = (tagname) => {
    return new Promise((resolve, reject) => {
        if ((typeof tagname === 'string' && tagname.length > 0) || typeof tagname === 'number') {
            git(dir).addtag(String(tagname), (err, tags) => {
                resolve(tags);
            });
        } else {
            reject(new Error('Invalid tag name'));
        }
    });
}