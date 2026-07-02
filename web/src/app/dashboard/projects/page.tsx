import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { Folder } from 'lucide-react';
import Link from 'next/link';
import { NewProjectButton } from '@/components/NewProjectModal';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let projects: Awaited<ReturnType<typeof prisma.projects.findMany>> = [];

  if (user) {
    const membership = await prisma.memberships.findFirst({
      where: { user_id: user.id },
      select: { organization_id: true },
    });

    if (membership?.organization_id) {
      projects = await prisma.projects.findMany({
        where: { organization_id: membership.organization_id },
        include: { _count: { select: { scraping_jobs: true } } },
        orderBy: { created_at: 'desc' },
      });
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
            const jobCount = (project as any)._count?.scraping_jobs ?? 0;
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
