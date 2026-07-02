import fs from 'fs';
import path from 'path';

// Scraper writes xlsx/csv files to <repo root>/results (one level above web/)
export const RESULTS_DIR = path.resolve(process.cwd(), '..', 'results');

export function queryToFilePrefix(query: string): string {
  return query.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function findLocalFile(query: string, completedAt: Date | null): string | null {
  try {
    if (!fs.existsSync(RESULTS_DIR)) return null;
    const prefix = queryToFilePrefix(query);
    const files = fs.readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith(prefix) && (f.endsWith('.xlsx') || f.endsWith('.csv')));
    if (files.length === 0) return null;
    if (files.length === 1) return files[0];
    if (completedAt) {
      const target = completedAt.getTime();
      files.sort((a, b) => {
        const ta = fs.statSync(path.join(RESULTS_DIR, a)).mtimeMs;
        const tb = fs.statSync(path.join(RESULTS_DIR, b)).mtimeMs;
        return Math.abs(ta - target) - Math.abs(tb - target);
      });
    }
    return files[0];
  } catch {
    return null;
  }
}

export function contentTypeFor(filename: string): string {
  if (filename.endsWith('.csv')) return 'text/csv; charset=utf-8';
  if (filename.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (filename.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}
