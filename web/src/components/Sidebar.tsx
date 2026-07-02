'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Search, Settings, CreditCard, LogOut, Sparkles, FileSpreadsheet, Table, Send } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
    { name: 'New Scrape', href: '/dashboard/scrape', icon: Search },
    { name: 'Results', href: '/dashboard/results', icon: FileSpreadsheet },
    { name: 'Data Editor', href: '/dashboard/editor', icon: Table },
    { name: 'Enrichment', href: '/dashboard/enrich', icon: Sparkles },
    { name: 'Outreach', href: '/dashboard/outreach', icon: Send },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <span className="text-xl font-bold text-primary tracking-tight">ClickVente</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <button
          onClick={handleSignOut}
          className="group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
