import { createClient } from '@/utils/supabase/server';
import { EnrichmentPanel } from '@/components/EnrichmentPanel';

export default async function EnrichPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let enrichBalance = 0;
  let totalEnrichments = 0;

  if (user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const orgId = membership?.organization_id;

    const [orgResult, countResult] = await Promise.all([
      orgId
        ? supabase.from('organizations').select('enrichment_credit_balance').eq('id', orgId).single()
        : Promise.resolve({ data: null }),
      supabase.from('enrichment_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    ]);

    enrichBalance = (orgResult.data as { enrichment_credit_balance?: number } | null)?.enrichment_credit_balance ?? 0;
    totalEnrichments = countResult.count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">LinkedIn Enrichment</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a completed scrape job and enrich it with LinkedIn company data, employee lists, or profile details.
          Credits are charged only on successful rows.{' '}
          <a href="/billing" className="underline text-primary">Buy credits →</a>
        </p>
      </div>

      <EnrichmentPanel enrichBalance={enrichBalance} totalEnrichmentJobs={totalEnrichments} />
    </div>
  );
}
