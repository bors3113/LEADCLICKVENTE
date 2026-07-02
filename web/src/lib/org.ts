import type { createClient } from '@/utils/supabase/server';

// Resolve the caller's organization id from their membership row.
// Duplicated inline across several routes historically; centralized here.
export async function getOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
  return membership?.organization_id ?? null;
}
