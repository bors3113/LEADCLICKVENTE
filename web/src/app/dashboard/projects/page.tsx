import { createClient } from '@/utils/supabase/server';
import { Plus, Folder } from 'lucide-react';
import Link from 'next/link';

export default async function ProjectsPage() {
  const supabase = await createClient();
  
  // In a real app, fetch real projects
  // const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  
  const mockProjects = [
    { id: '1', name: 'Paris Restaurants', description: 'Finding fine dining locations in Paris.', jobCount: 3, lastRun: '2 hours ago' },
    { id: '2', name: 'London Tech Agencies', description: 'B2B leads for marketing.', jobCount: 5, lastRun: '1 day ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold leading-6 text-foreground">Projects</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize your scraping tasks into distinct projects.
          </p>
        </div>
        <button className="flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockProjects.map((project) => (
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
              <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>
            
            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
              <span>{project.jobCount} Jobs</span>
              <span>Last run {project.lastRun}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
