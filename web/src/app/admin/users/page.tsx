import { createClient } from '@/utils/supabase/server';
import { Search, MoreVertical, Edit, Trash2, Ban } from 'lucide-react';

export default async function UserManagement() {
  const supabase = await createClient();

  // In reality, this would fetch from a custom users/profiles table or use the Supabase Admin API
  // const { data: users } = await supabase.from('users').select('*');
  
  const mockUsers = [
    { id: '1', email: 'founder@startup.com', role: 'admin', plan: 'Pro', status: 'Active', joined: '2023-10-01' },
    { id: '2', email: 'marketing@agency.co', role: 'member', plan: 'Hobby', status: 'Active', joined: '2023-11-15' },
    { id: '3', email: 'spammer@bot.net', role: 'member', plan: 'Hobby', status: 'Banned', joined: '2023-12-05' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">Manage user accounts, roles, and subscriptions.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
          Invite User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option>All Plans</option>
              <option>Pro</option>
              <option>Hobby</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500 bg-white">
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="ml-3 text-sm font-medium text-slate-900">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 capitalize">{user.role}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                      user.plan === 'Pro' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                      user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.joined}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 p-1">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl text-sm text-slate-500">
          <span>Showing 1 to 3 of 3 users</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded bg-white disabled:opacity-50">Previous</button>
            <button className="px-3 py-1 border border-slate-200 rounded bg-white disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
