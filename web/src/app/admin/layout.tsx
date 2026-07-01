import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Users, Server, Activity } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // In a real app, verify user is an admin via a users or roles table
  // const { data: role } = await supabase.from('users').select('role').eq('id', user.id).single();
  // if (role?.role !== 'super_admin') redirect('/dashboard');

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="h-16 flex items-center px-6 bg-slate-950 font-bold text-white tracking-wider uppercase text-sm">
          <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
          Super Admin
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/admin" className="flex items-center px-2 py-2 rounded hover:bg-slate-800 text-white">
            <Activity className="w-5 h-5 mr-3" /> System Overview
          </Link>
          <Link href="/admin/users" className="flex items-center px-2 py-2 rounded hover:bg-slate-800">
            <Users className="w-5 h-5 mr-3" /> User Management
          </Link>
          <Link href="/admin/infrastructure" className="flex items-center px-2 py-2 rounded hover:bg-slate-800">
            <Server className="w-5 h-5 mr-3" /> Infrastructure
          </Link>
        </nav>
        <div className="p-4 bg-slate-950 text-xs text-slate-500">
          Restricted Area
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">System Administration</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
