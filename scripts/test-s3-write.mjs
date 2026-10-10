import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.argv[2];
if (!bucket) {
    console.error('Usage: node scripts/test-s3-write.mjs <bucket>');
    process.exit(1);
}

const client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
    },
});

try {
    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: 'photolab/_connectivity_test.txt',
            Body: 'ok',
            ContentType: 'text/plain',
        }),
    );
    console.log(`PUT ok: ${bucket}`);
} catch (e) {
    console.error(`PUT failed: ${e.name} ${e.message}`);
    process.exit(1);
}
