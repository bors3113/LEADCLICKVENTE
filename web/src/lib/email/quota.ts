import { prisma } from '@/lib/prisma';

// Free monthly email-sending quota per organization, backed by the
// (previously unwired) usage_tracking table. Drawn before paid credits;
// see web/src/lib/email/credits.ts for the paid-credit counterpart.

export function freeEmailsPerMonth(): number {
  const n = Number(process.env.FREE_EMAILS_PER_MONTH);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1000;
}

export function currentBillingPeriodStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function ensureUsageRow(organizationId: string, periodStart: Date) {
  await prisma.usage_tracking.upsert({
    where: { organization_id_billing_period_start: { organization_id: organizationId, billing_period_start: periodStart } },
    create: { organization_id: organizationId, billing_period_start: periodStart, credits_used: 0 },
    update: {},
  });
}

// Free emails remaining this month (0 if the monthly pool is exhausted).
export async function getFreeQuotaRemaining(organizationId: string): Promise<number> {
  const periodStart = currentBillingPeriodStart();
  await ensureUsageRow(organizationId, periodStart);

  const row = await prisma.usage_tracking.findUnique({
    where: { organization_id_billing_period_start: { organization_id: organizationId, billing_period_start: periodStart } },
    select: { credits_used: true },
  });
  const used = row?.credits_used ?? 0;
  return Math.max(0, freeEmailsPerMonth() - used);
}

// Atomically consume up to `count` free sends for the current month, guarded
// so concurrent sends can never push credits_used past the monthly limit.
// Returns how many were actually consumed (may be less than requested).
export async function consumeFreeQuota(organizationId: string, count: number): Promise<number> {
  if (count <= 0) return 0;
  const periodStart = currentBillingPeriodStart();
  await ensureUsageRow(organizationId, periodStart);

  const limit = freeEmailsPerMonth();
  const affected = await prisma.$executeRaw`
    UPDATE usage_tracking
    SET credits_used = COALESCE(credits_used, 0) + ${count}
    WHERE organization_id = ${organizationId}::uuid
      AND billing_period_start = ${periodStart}
      AND COALESCE(credits_used, 0) + ${count} <= ${limit}`;
  if (affected > 0) return count;

  // The full amount didn't fit — consume whatever remains, if any (handles
  // the boundary case where another concurrent send used some of the pool
  // between getFreeQuotaRemaining() and this call).
  const remaining = await getFreeQuotaRemaining(organizationId);
  if (remaining <= 0) return 0;
  const partial = await prisma.$executeRaw`
    UPDATE usage_tracking
    SET credits_used = COALESCE(credits_used, 0) + ${remaining}
    WHERE organization_id = ${organizationId}::uuid
      AND billing_period_start = ${periodStart}
      AND COALESCE(credits_used, 0) + ${remaining} <= ${limit}`;
  return partial > 0 ? remaining : 0;
}
