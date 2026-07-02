'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Download, Pause, Play, Square, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Job = {
  id: string;
  config: Record<string, unknown>;
  status: string;
  progress: number;
  created_at: string;
};

type Action = 'pause' | 'stop' | 'resume';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
  running:   'bg-blue-100 text-blue-800',
  queued:    'bg-yellow-100 text-yellow-800',
  paused:    'bg-amber-100 text-amber-800',
  stopped:   'bg-gray-100 text-gray-600',
};

export function ActiveJobsPanel({ title = 'Your jobs', limit = 10 }: { title?: string; limit?: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, Action>>({});
  const jobsRef = useRef<Job[]>([]);
  const realtimeUpRef = useRef(false);
  const supabase = createClient();

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data) {
      setJobs(data);
      jobsRef.current = data;
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('scrape-page:scraping_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scraping_jobs' }, () => {
        fetchJobs();
      })
      .subscribe((status) => {
        realtimeUpRef.current = status === 'SUBSCRIBED';
      });

    // Fallback polling: realtime WebSockets can drop silently, so refetch on an
    // interval whenever the channel is down or a job is still in flight.
    const interval = setInterval(() => {
      const hasActive = jobsRef.current.some(j => j.status === 'queued' || j.status === 'running');
      if (!realtimeUpRef.current || hasActive) fetchJobs();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (jobId: string) => {
    const tid = toast.loading('Preparing export…');
    try {
      const res = await fetch(`/api/export?jobId=${jobId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/csv')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job_${jobId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded', { id: tid });
      } else {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
          toast.success('Export ready', { id: tid });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to export CSV.', { id: tid });
    }
  };

  const handleAction = async (jobId: string, action: Action) => {
    setPending(prev => ({ ...prev, [jobId]: action }));
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }
      // Realtime subscription will refresh the row automatically
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} job`);
    } finally {
      setPending(prev => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This will permanently delete the scraped file and all associated data. This action cannot be undone.')) {
      return;
    }
    setPending(prev => ({ ...prev, [jobId]: 'stop' }));
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Deletion failed' }));
        throw new Error(err.error || 'Deletion failed');
      }
      toast.success('Job deleted successfully');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    } finally {
      setPending(prev => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-background rounded-lg border border-border shadow-sm p-6">
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="bg-background rounded-lg border border-border shadow-sm p-6 space-y-4">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <ul className="divide-y divide-border">
        {jobs.map((job) => {
          const scraped = job.progress || 0;
          const jobLimit = (job.config?.limit as number) || 0;
          const pct = jobLimit > 0
            ? Math.min(100, (scraped / jobLimit) * 100)
            : (job.status === 'completed' ? 100 : 0);

          const isBusy = pending[job.id] !== undefined;
          const busyAction = pending[job.id];

          return (
            <li key={job.id} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {(job.config?.query as string) || 'Unknown query'}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-2 max-w-[140px]">
                    <div
                      className={`h-2 rounded-full transition-all ${job.status === 'failed' ? 'bg-red-500' : job.status === 'stopped' ? 'bg-gray-400' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {scraped}{jobLimit > 0 ? ` / ${jobLimit}` : ''} items
                  </span>
                </div>
              </div>

              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[job.status] ?? 'bg-muted text-muted-foreground'}`}>
                {job.status}
              </span>

              {/* Control buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {job.status === 'running' && (
                  <>
                    <button
                      onClick={() => handleAction(job.id, 'pause')}
                      disabled={isBusy}
                      title="Pause"
                      className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {isBusy && busyAction === 'pause'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleAction(job.id, 'stop')}
                      disabled={isBusy}
                      title="Stop"
                      className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {isBusy && busyAction === 'stop'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </>
                )}

                {(job.status === 'paused' || job.status === 'stopped') && (
                  <>
                    <button
                      onClick={() => handleAction(job.id, 'resume')}
                      disabled={isBusy}
                      title="Resume (re-runs from start)"
                      className="p-1.5 rounded-md text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {isBusy && busyAction === 'resume'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Play className="h-4 w-4" />}
                    </button>
                    {job.status === 'paused' && (
                      <button
                        onClick={() => handleAction(job.id, 'stop')}
                        disabled={isBusy}
                        title="Stop"
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {isBusy && busyAction === 'stop'
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    )}
                  </>
                )}

                {job.status === 'completed' && (
                  <button
                    onClick={() => handleExport(job.id)}
                    className="text-primary hover:text-primary/80 flex items-center text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary/5 px-2 py-1.5 rounded-md transition-colors"
                  >
                    <Download className="mr-1 h-4 w-4" /> CSV
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={isBusy}
                  title="Delete Job"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isBusy && busyAction === 'stop' ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
