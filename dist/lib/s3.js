'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.upload = exports.createBucket = undefined;

var _file = require('./common/file');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var s3 = function s3() {
    if (!s3.s3Ref) {
        var libAws = require('aws-sdk');
        var credentials = new libAws.SharedIniFileCredentials({ profile: 'mri-gc-account' });
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
var createBucket = exports.createBucket = function createBucket(bucketName) {
    return new Promise(function (resolve, reject) {
        var s3Ref = s3();
        s3Ref.listBuckets(function (err, data) {
            if (err) {
                reject(new Error(err));
            } else {
                // Check if the bucket already exist.
                if (data.Buckets.find(function (bucket) {
                    return bucket.Name === bucketName;
                })) {
                    resolve(bucket.Location);
                } else {
                    // Call S3 to create the bucket
                    s3Ref.createBucket({ Bucket: bucketName }, function (err, data) {
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
var upload = exports.upload = function upload(filepath, key, bucket) {
    return new Promise(function (resolve, reject) {
        var validParams = [filepath, key, bucket].find(function (p) {
            return typeof p !== 'string' || p.length === 0;
        }) === undefined;
        validParams = validParams && (key.length > 1 || key[0] !== '/');
        if (validParams) {
            if (key[0] === '/') {
                key = key.substr(1);
            }
            var buffer = _fs2.default.readFileSync(filepath);
            if (buffer) {
                var s3Ref = s3();
                s3Ref.putObject({
                    ACL: 'public-read',
                    Bucket: bucket,
                    Key: '' + key,
                    Body: buffer,
                    ContentType: (0, _file.contentType)(filepath)
                }, function (err, response) {
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