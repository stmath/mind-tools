import {contentType} from './common/file';
import FS from 'fs';

const s3Ref = () => {
	if (!s3Ref.s3Ref) {
		const libAws = require('aws-sdk');
		const credentials = new libAws.SharedIniFileCredentials({profile: 'mri-gc-account'});
		libAws.config.credentials = credentials;
		s3Ref.s3Ref = new libAws.S3();
	}
	return s3Ref.s3Ref;
};

export const createBucket = bucketName => {
    return new Promise ((resolve, reject) => {
        const s3Ref = s3Ref();
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

export const upload = (filepath, key, bucket) => {
    return new Promise ((resolve, reject) => {
        const validParams = [filepath, key, bucket]
                            .find(p => typeof p !== 'string' || p.length === 0) === undefined;
        if (validParams) {
            const buffer = FS.readFileSync(filepath);
            if (buffer) {
                const s3Ref = s3Ref();
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
