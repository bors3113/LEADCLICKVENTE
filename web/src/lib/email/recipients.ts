import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

// Reads a scraped/enriched result file (xlsx or csv) from R2 or the local
// results/ dir and extracts mailable recipients.

const RESULTS_DIR = path.resolve(process.cwd(), '..', 'results');
const ENRICHED_PREFIX = 'enriched/';

export interface Recipient {
  email: string;
  name: string | null;
  company: string | null;
  raw: Record<string, unknown>;
}

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Fetch the file bytes. `key` is an R2 object key (enriched/…); `file` is a
// local basename fallback. Mirrors /api/enriched/download validation.
async function readFileBytes(key: string | null, file: string | null): Promise<Buffer> {
  if (key) {
    if (!/^enriched\/[\w\-. ]+\.(xlsx|csv)$/.test(key)) throw new Error('Invalid key');
    const r2 = getR2Client();
    if (r2) {
      const bucket = process.env.R2_BUCKET || 'leadsclickvente';
      const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!obj.Body) throw new Error('Empty object from storage');
      return Buffer.from(await obj.Body.transformToByteArray());
    }
    file = file || key.slice(ENRICHED_PREFIX.length);
  }
  if (!file || !/^[\w\-. ]+\.(xlsx|csv)$/.test(file)) throw new Error('File not found');
  const filePath = path.join(RESULTS_DIR, file);
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  return fs.readFileSync(filePath);
}

async function parseRows(buffer: Buffer, filename: string): Promise<Record<string, unknown>[]> {
  if (filename.endsWith('.csv')) {
    const Papa = (await import('papaparse')).default;
    const text = buffer.toString('utf8');
    const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return res.data;
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Column-name preference order for pulling the address / name / company.
const EMAIL_KEYS = ['li_profile_email', 'email', 'emails', 'contact_email', 'work_email'];
const NAME_KEYS = ['name', 'full_name', 'li_profile_name', 'first_name', 'contact_name'];
const COMPANY_KEYS = ['business_name', 'company', 'company_name', 'organization'];

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v;
  for (const key of keys) {
    const v = lower[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function firstEmail(value: string): string | null {
  // A cell may hold multiple emails (comma/semicolon/space separated).
  for (const part of value.split(/[,;\s]+/)) {
    const candidate = part.trim().toLowerCase();
    if (EMAIL_RE.test(candidate)) return candidate;
  }
  return null;
}

function rowsToRecipients(rows: Record<string, unknown>[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const row of rows) {
    const rawEmail = pick(row, EMAIL_KEYS);
    if (!rawEmail) continue;
    const email = firstEmail(rawEmail);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: pick(row, NAME_KEYS),
      company: pick(row, COMPANY_KEYS),
      raw: row,
    });
  }
  return out;
}

// Parse an in-memory file (e.g. a user upload) into de-duplicated recipients.
// Shares all column-detection/dedup logic with extractRecipients below.
export async function extractRecipientsFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<Recipient[]> {
  const rows = await parseRows(buffer, filename);
  return rowsToRecipients(rows);
}

// Parse a scraped/enriched result file (by R2 key or local basename) into
// de-duplicated recipients with a valid email.
export async function extractRecipients(
  key: string | null,
  file: string | null
): Promise<Recipient[]> {
  const filename = (file || key || '').split('/').pop() || '';
  const buffer = await readFileBytes(key, file);
  return extractRecipientsFromBuffer(buffer, filename);
}

// Remove recipients the org has on its suppression list. Shared by both the
// existing-file recipients route and the upload route.
export async function filterSuppressed(
  organizationId: string,
  recipients: Recipient[]
): Promise<{ recipients: Recipient[]; suppressedCount: number }> {
  const suppressed = await prisma.unsubscribes.findMany({
    where: { organization_id: organizationId },
    select: { email: true },
  });
  const blocked = new Set(suppressed.map((s) => s.email.toLowerCase()));
  const filtered = recipients.filter((r) => !blocked.has(r.email));
  return { recipients: filtered, suppressedCount: recipients.length - filtered.length };
}
