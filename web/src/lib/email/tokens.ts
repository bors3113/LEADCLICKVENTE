import crypto from 'crypto';

// AES-256-GCM encryption for OAuth tokens stored in the `mailboxes` table.
// We never persist plaintext refresh/access tokens. The key comes from
// EMAIL_TOKEN_ENC_KEY: 32 bytes, provided as base64 (preferred) or hex.
//
// Stored format:  v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

function getKey(): Buffer {
  const raw = process.env.EMAIL_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error('EMAIL_TOKEN_ENC_KEY is not set — cannot encrypt/decrypt mailbox tokens.');
  }
  // Try base64 first, then hex; require exactly 32 bytes for AES-256.
  let key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    const hexKey = Buffer.from(raw, 'hex');
    if (hexKey.length === 32) key = hexKey;
  }
  if (key.length !== 32) {
    throw new Error(
      'EMAIL_TOKEN_ENC_KEY must decode to 32 bytes (base64 or hex). ' +
        'Generate one with: openssl rand -base64 32'
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptToken(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted token payload.');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

// Nullable helpers for optional token columns.
export function encryptTokenOrNull(plaintext: string | null | undefined): string | null {
  return plaintext ? encryptToken(plaintext) : null;
}

export function decryptTokenOrNull(stored: string | null | undefined): string | null {
  return stored ? decryptToken(stored) : null;
}
