const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const fs = require('fs');
const path = require('path');

function getR2Client() {
    if (!config.r2.enabled) return null;
    return new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });
}

/**
 * Upload a local file to R2. Returns the R2 object key, or null if R2 is not configured.
 * @param {string} localFilePath  Absolute path to the file on disk.
 * @param {string} [r2Key]        Desired R2 object key. Defaults to "results/<basename>".
 */
async function uploadToR2(localFilePath, r2Key) {
    const client = getR2Client();
    if (!client) return null;

    const key = r2Key || `results/${path.basename(localFilePath)}`;
    const body = fs.readFileSync(localFilePath);
    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = ext === '.csv' ? 'text/csv'
        : ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/octet-stream';

    await client.send(new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
    }));

    return key;
}

module.exports = { uploadToR2 };
