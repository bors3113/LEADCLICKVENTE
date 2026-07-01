import { createClient } from '@/utils/supabase/server';
import { Users, Server, Zap, AlertTriangle } from 'lucide-react';

export default async function AdminOverview() {
  const supabase = await createClient();

  // Mocked global metrics for Admin
  const metrics = [
    { name: 'Total Users', value: '1,248', icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { name: 'Active Workers', value: '4/10', icon: Server, color: 'text-green-500', bg: 'bg-green-100' },
    { name: 'API Requests (24h)', value: '1.2M', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-100' },
    { name: 'Failed Jobs (24h)', value: '23', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Global Overview</h2>
        <p className="mt-1 text-sm text-slate-500">Monitor platform health and user metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
            <div className={`p-3 rounded-lg ${metric.bg} mr-4`}>
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{metric.name}</p>
              <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent User Signups</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                    U{i}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-slate-900">user{i}@example.com</p>
                    <p className="text-xs text-slate-500">Joined {i} hour(s) ago</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Pro Plan</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">System Alerts</h3>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex">
              <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">High Proxy Error Rate</p>
                <p className="text-xs text-amber-700 mt-1">Detected elevated 403 responses from residential proxy pool in EU region.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
