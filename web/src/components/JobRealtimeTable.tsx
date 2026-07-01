'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowUpRight, Download } from 'lucide-react';

type Job = {
  id: string;
  config: any;
  status: string;
  progress: number;
  created_at: string;
};

export function JobRealtimeTable() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const supabase = createClient();

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (data) setJobs(data);
  };

  useEffect(() => {
    fetchJobs();

    // Subscribe to realtime changes on the scraping_jobs table
    const channel = supabase
      .channel('public:scraping_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scraping_jobs' },
        (payload) => {
          console.log('Realtime update received:', payload);
          fetchJobs(); // Refetch to get the latest ordered state
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleExport = async (jobId: string) => {
    try {
      const res = await fetch(`/api/export?jobId=${jobId}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV. Please try again.');
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium leading-6 text-foreground">Recent Jobs</h3>
        <Link href="/dashboard/projects" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center">
          View all <ArrowUpRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
      
      <div className="mt-4 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow-sm ring-1 ring-border rounded-lg">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Query</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Progress</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-sm text-muted-foreground">
                        No jobs found. Start your first extraction!
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                          {job.config?.query || 'Unknown query'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground capitalize">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                          <div className="w-full bg-muted rounded-full h-2.5 max-w-[120px]">
                            <div 
                              className={`h-2.5 rounded-full ${job.status === 'failed' ? 'bg-red-500' : 'bg-primary'}`} 
                              style={{ width: `${job.progress || 0}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {job.status === 'completed' && (
                            <button 
                              onClick={() => handleExport(job.id)}
                              className="text-primary hover:text-primary/80 flex items-center justify-end"
                            >
                              <Download className="mr-1 h-4 w-4" /> Export CSV
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
