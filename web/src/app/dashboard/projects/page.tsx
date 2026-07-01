import { createClient } from '@/utils/supabase/server';
import { Folder } from 'lucide-react';
import Link from 'next/link';
import { NewProjectButton } from '@/components/NewProjectModal';

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  scraping_jobs: { count: number }[];
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let projects: Project[] = [];

  if (user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membership?.organization_id) {
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, created_at, scraping_jobs(count)')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false });

      projects = (data as Project[]) ?? [];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold leading-6 text-foreground">Projects</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize your scraping tasks into distinct projects.
          </p>
        </div>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium text-foreground">No projects yet</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a project to organize your scraping jobs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const jobCount = project.scraping_jobs?.[0]?.count ?? 0;
            const lastRun = project.created_at
              ? new Date(project.created_at).toLocaleDateString()
              : '—';

            return (
              <div
                key={project.id}
                className="relative flex flex-col justify-between rounded-lg border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Folder className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="truncate text-lg font-medium text-foreground">
                      <Link href={`/dashboard/projects/${project.id}`} className="focus:outline-none">
                        <span className="absolute inset-0" aria-hidden="true" />
                        {project.name}
                      </Link>
                    </h3>
                  </div>
                  {project.description && (
                    <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
                  <span>{jobCount} Job{jobCount !== 1 ? 's' : ''}</span>
                  <span>Created {lastRun}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
