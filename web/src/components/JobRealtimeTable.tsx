'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowUpRight, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type Job = {
  id: string;
  config: Record<string, unknown>;
  status: string;
  progress: number;
  created_at: string;
};

const PAGE_SIZE = 5;

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-3 py-4">
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: i === 1 ? '60%' : i === 4 ? '40%' : '30%' }} />
        </td>
      ))}
    </tr>
  );
}

export function JobRealtimeTable() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchJobs = async (currentPage = page) => {
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('scraping_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) setJobs(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs(page);

    const channel = supabase
      .channel('public:scraping_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scraping_jobs' }, () => {
        fetchJobs(page);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleExport = async (jobId: string) => {
    const tid = toast.loading('Preparing export…');
    try {
      const res = await fetch(`/api/export?jobId=${jobId}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('Export ready', { id: tid });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV. Please try again.', { id: tid });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonRow key={i} />)
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No jobs found. Start your first extraction!
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                          {(job.config?.query as string) || 'Unknown query'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground capitalize">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'failed' ? 'bg-red-100 text-red-800' :
                            job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                          {(() => {
                            const scraped = job.progress || 0;
                            const limit = (job.config?.limit as number) || 0;
                            const pct = limit > 0
                              ? Math.min(100, (scraped / limit) * 100)
                              : (job.status === 'completed' ? 100 : 0);
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-muted rounded-full h-2.5 max-w-[100px]">
                                  <div
                                    className={`h-2.5 rounded-full transition-all ${job.status === 'failed' ? 'bg-red-500' : 'bg-primary'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-foreground whitespace-nowrap">
                                  {scraped}{limit > 0 ? ` / ${limit}` : ''}
                                  <span className="text-muted-foreground"> items</span>
                                </span>
                              </div>
                            );
                          })()}
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
