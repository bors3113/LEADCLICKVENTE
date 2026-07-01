import { createClient } from '@/utils/supabase/server';
import { Activity, Users, Database } from 'lucide-react';
import { JobRealtimeTable } from '@/components/JobRealtimeTable';

export default async function DashboardOverview() {
  const supabase = await createClient();
  
  // Fetch some stats from the database (mocked for UI design right now)
  const stats = [
    { name: 'Total Extractions', stat: '12,450', icon: Database, change: '+12%', changeType: 'positive' },
    { name: 'Active Jobs', stat: '3', icon: Activity, change: 'Running', changeType: 'neutral' },
    { name: 'Credits Remaining', stat: '8,550', icon: Users, change: '10,000 total', changeType: 'neutral' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">Overview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Monitor your scraping operations and credit usage.
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
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
              <p
                className={`ml-2 flex items-baseline text-sm font-semibold ${
                  item.changeType === 'positive' ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {item.change}
              </p>
            </dd>
          </div>
        ))}
      </dl>

      <JobRealtimeTable />
    </div>
  );
}
