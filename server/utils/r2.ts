import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function useR2(): S3Client {
  if (client) return client;

  const accountId = process.env.NUXT_R2_ACCOUNT_ID;
  const accessKeyId = process.env.NUXT_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NUXT_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "[r2] Missing R2 credentials. Set NUXT_R2_ACCOUNT_ID, NUXT_R2_ACCESS_KEY_ID, NUXT_R2_SECRET_ACCESS_KEY.",
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export function getR2Bucket(): string {
  const bucket = process.env.NUXT_R2_BUCKET;
  if (!bucket) throw new Error("[r2] NUXT_R2_BUCKET is not set");
  return bucket;
}
