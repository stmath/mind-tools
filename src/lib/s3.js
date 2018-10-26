import {contentType} from './common/file';
import FS from 'fs';

const s3 = () => {
	if (!s3.s3Ref) {
		const libAws = require('aws-sdk');
		const credentials = new libAws.SharedIniFileCredentials({profile: 'mri-gc-account'});
		libAws.config.credentials = credentials;
		s3.s3Ref = new libAws.S3();
	}
	return s3.s3Ref;
};

/**
 * Creates a bucket in S3.
 *
 * @param {string} bucketName: name of bucket.
 * @returns
 */
export const createBucket = bucketName => {
    return new Promise ((resolve, reject) => {
        const s3Ref = s3();
        s3Ref.listBuckets((err, data) => {
            if (err) {
                reject(new Error(err));
            } else {
                // Check if the bucket already exist.
                if (data.Buckets.find(bucket => bucket.Name === bucketName)) {
                    resolve(bucket.Location);
                } else {
                    // Call S3 to create the bucket
                    s3Ref.createBucket({Bucket : bucketName}, (err, data) => {
                        if (err) {
                            reject(new Error(err));
                        } else {
                            resolve(data.Location);
                        }
                    });
                }
            }
        });
    });
};


/**
 * Uploads a file to AWS S3.
 *
 * @param {string} bucketName: Path to file.
 * @param {string} key: File key in aws s3 service.
 * @param {string} bucket: name of bucket.
 * @returns
 */
export const upload = (filepath, key, bucket) => {
    return new Promise ((resolve, reject) => {
        let validParams = [filepath, key, bucket]
                            .find(p => typeof p !== 'string' || p.length === 0) === undefined;
        validParams = validParams && (key.length > 1 || key[0] !== '/');
        if (validParams) {
            if (key[0] === '/') {
                key = key.substr(1);
            }
            const buffer = FS.readFileSync(filepath);
            if (buffer) {
                const s3Ref = s3();
                s3Ref.putObject({
                    ACL: 'public-read',
                    Bucket: bucket,
                    Key: `${key}`,
                    Body: buffer,
                    ContentType: contentType(filepath)
                }, (err, response) => {
                    if (err) {
                        reject(new Error(err));
                    } else {
                        resolve(response);
                    }
                });
            } else {
                reject(new Error("Can't open file."));
            }
        } else {
            reject(new Error('Invalid Params'));
        }
    });
};
