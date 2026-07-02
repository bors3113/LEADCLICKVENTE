import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { Activity, Database, CreditCard, Sparkles } from 'lucide-react';
import { JobRealtimeTable } from '@/components/JobRealtimeTable';

export default async function DashboardOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const membershipQuery = user
    ? prisma.memberships.findFirst({
        where: { user_id: user.id },
        select: { organization_id: true },
      })
    : Promise.resolve(null);

  const [totalExtractions, activeJobsCount, totalEnrichments, membership] = await Promise.all([
    prisma.extracted_records.count(),
    prisma.scraping_jobs.count({ where: { status: { in: ['queued', 'running'] } } }),
    prisma.enrichment_jobs.count({ where: { status: 'completed' } }),
    membershipQuery,
  ]);

  const orgId = membership?.organization_id ?? '';

  const org = orgId
    ? await prisma.organizations.findUnique({
        where: { id: orgId },
        select: { enrichment_credit_balance: true },
      })
    : null;

  const enrichBalance = org?.enrichment_credit_balance ?? 0;

  const stats = [
    {
      name: 'Total Extractions',
      stat: totalExtractions.toLocaleString(),
      icon: Database,
      sub: 'all time',
    },
    {
      name: 'Active Jobs',
      stat: String(activeJobsCount),
      icon: Activity,
      sub: 'queued or running',
    },
    {
      name: 'Enrichments Done',
      stat: totalEnrichments.toLocaleString(),
      icon: CreditCard,
      sub: 'completed LinkedIn enrichments',
    },
    {
      name: 'Enrichment Credits',
      stat: enrichBalance.toLocaleString(),
      icon: Sparkles,
      sub: 'LinkedIn PAYG balance',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">Overview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Monitor your scraping operations and credit usage.
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-lg border border-border bg-background px-4 pb-12 pt-5 shadow-sm sm:px-6 sm:pt-6"
          >
            <dt>
              <div className="absolute rounded-md bg-primary/10 p-3">
                <item.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-muted-foreground">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-semibold text-foreground">{item.stat}</p>
              <p className="ml-2 flex items-baseline text-sm text-muted-foreground">{item.sub}</p>
            </dd>
          </div>
        ))}
      </dl>

      <JobRealtimeTable />
    </div>
  );
}
