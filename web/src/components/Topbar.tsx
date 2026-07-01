'use client';

import { Bell, User } from 'lucide-react';

export function Topbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-primary"></span>
        </button>
        
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-foreground">{userEmail || 'User'}</span>
        </div>
      </div>
    </header>
  );
}
