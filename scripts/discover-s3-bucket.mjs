import 'dotenv/config';
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';

const key = process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const secret = process.env.AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'ap-south-1';

if (!key || !secret) {
    console.error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env');
    process.exit(1);
}

const client = new S3Client({
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
});

const out = await client.send(new ListBucketsCommand({}));
const names = (out.Buckets ?? []).map((b) => b.Name).filter(Boolean);
console.log(JSON.stringify({ region, buckets: names }, null, 2));
