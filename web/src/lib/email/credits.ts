import { prisma } from '@/lib/prisma';

// Credit metering for email sends, mirroring the enrichment/copilot pattern.
// The `enrichment_credit_balance` column lives in the Supabase SQL migration
// but NOT in prisma/schema.prisma, so it is read/written via raw SQL.

export function creditsPerEmail(): number {
  const n = Number(process.env.CREDITS_PER_EMAIL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export async function getAvailableCredits(organizationId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ payg: number }[]>`
    SELECT COALESCE(enrichment_credit_balance, 0)::int AS payg
    FROM organizations
    WHERE id = ${organizationId}::uuid
    LIMIT 1`;
  return rows[0]?.payg ?? 0;
}

// Atomically decrement credits, guarded so the balance can never go negative
// even under concurrent sends. Returns true if the charge was applied.
export async function chargeCredits(organizationId: string, cost: number): Promise<boolean> {
  if (cost <= 0) return true;
  const affected = await prisma.$executeRaw`
    UPDATE organizations
    SET enrichment_credit_balance = COALESCE(enrichment_credit_balance, 0) - ${cost}
    WHERE id = ${organizationId}::uuid
      AND COALESCE(enrichment_credit_balance, 0) >= ${cost}`;
  return affected > 0;
}
