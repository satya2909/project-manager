// Task attachment storage — Cloudflare R2 via its S3-compatible API.
//
// Replaces local `diskStorage` (plans/TODOS.md's re-audited deployment
// blocker: Render web services don't have a persistent disk by default, so
// every deploy/restart silently wiped uploaded attachments, and a
// multi-instance deploy would 404 on whichever instance didn't happen to
// receive the upload). R2's API is S3-compatible, so this is a plain
// @aws-sdk/client-s3 client pointed at R2's endpoint — the same client works
// unchanged against AWS S3 or any other S3-compatible provider by swapping
// the endpoint/credential env vars, no code change needed.
//
// Additive/optional, same posture as the GitHub App integration
// (github-app-config.js): a deployment that hasn't set these up yet must
// still start cleanly. Each call site checks isObjectStorageConfigured()
// itself and fails loudly (503) only when actually invoked.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2's region is always the literal string "auto" — it isn't a real AWS
// region, just what R2's S3-compatible endpoint expects in that field.
const R2_REGION = "auto";

function getConfig() {
  return {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    // e.g. https://<account-id>.r2.cloudflarestorage.com
    endpoint: process.env.R2_ENDPOINT,
    bucket: process.env.R2_BUCKET_NAME,
    // Public download base for the bucket, no trailing slash — either R2's
    // own `https://pub-<hash>.r2.dev` dev subdomain (enabled per-bucket in
    // the Cloudflare dashboard) or a custom domain connected in front of it.
    publicUrlBase: process.env.R2_PUBLIC_URL_BASE,
  };
}

export function isObjectStorageConfigured() {
  const { accessKeyId, secretAccessKey, endpoint, bucket, publicUrlBase } = getConfig();
  return Boolean(accessKeyId && secretAccessKey && endpoint && bucket && publicUrlBase);
}

let client = null;
function getClient() {
  if (client) return client;
  const { accessKeyId, secretAccessKey, endpoint } = getConfig();
  client = new S3Client({
    endpoint,
    region: R2_REGION,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // R2's S3-compatible API requires path-style requests
  });
  return client;
}

// ─── uploadObject ─────────────────────────────────────────────────────────────
export async function uploadObject({ key, body, contentType }) {
  const { bucket, publicUrlBase } = getConfig();

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return `${publicUrlBase}/${key}`;
}

// ─── deleteObject ──────────────────────────────────────────────────────────────
export async function deleteObject({ key }) {
  const { bucket } = getConfig();
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
