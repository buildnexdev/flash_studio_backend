import 'dotenv/config';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const key = process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const secret = process.env.AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'ap-south-1';

const candidates = [
    process.env.AWS_S3_BUCKET,
    process.env.AWS_BUCKET,
    'nmpi-uploads',
    'nmpi-s3',
    'nmpi-s3-uploads',
    'nmpi-s3-uploader',
    'buildnex-flash-studio',
    'flash-studio',
    'flashlight-studio',
    'buildnextdev',
    'admin-panel-uploads',
].filter(Boolean);

const client = new S3Client({
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
});

for (const name of candidates) {
    try {
        await client.send(new HeadBucketCommand({ Bucket: name }));
        console.log(`OK ${name}`);
        process.exit(0);
    } catch (e) {
        console.log(`NO ${name}: ${e.name} ${e.$metadata?.httpStatusCode ?? ''}`);
    }
}
process.exit(1);
