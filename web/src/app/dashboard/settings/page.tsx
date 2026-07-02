import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { User, Lock, Building2 } from 'lucide-react';
import { updateProfile, updatePassword, updateOrganization } from './actions';
import ApiKeysSection from './ApiKeysSection';
import MailboxesSection from './MailboxesSection';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await prisma.memberships.findFirst({
    where: { user_id: user.id },
    select: { organization_id: true, role: true },
  });
  const orgId = membership?.organization_id ?? user.id;
  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  const [profile, org] = await Promise.all([
    prisma.public_users.findUnique({
      where: { id: user.id },
      select: { full_name: true, avatar_url: true },
    }),
    prisma.organizations.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true, enrichment_credit_balance: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your profile, security, and organization.</p>
      </div>

      <div className="space-y-8">
        {/* Profile */}
        <section className="bg-background rounded-lg border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Profile</h2>
          </div>
          <form action={updateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={user.email ?? ''}
                disabled
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-1">Full name</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                defaultValue={profile?.full_name ?? ''}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="avatar_url" className="block text-sm font-medium text-foreground mb-1">Avatar URL</label>
              <input
                id="avatar_url"
                name="avatar_url"
                type="url"
                defaultValue={profile?.avatar_url ?? ''}
                placeholder="https://example.com/avatar.png"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition"
            >
              Save profile
            </button>
          </form>
        </section>

        {/* Security */}
        <section className="bg-background rounded-lg border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Security</h2>
          </div>
          <form action={updatePassword} className="space-y-4">
            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-foreground mb-1">New password</label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-foreground mb-1">Confirm new password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition"
            >
              Update password
            </button>
          </form>
        </section>

        {/* Organization */}
        <section className="bg-background rounded-lg border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Organization</h2>
          </div>

          {isOwnerOrAdmin ? (
            <form action={updateOrganization} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Organization name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={org?.name ?? ''}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-1">Organization slug</label>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  pattern="[a-z0-9\-]+"
                  defaultValue={org?.slug ?? ''}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 transition"
              >
                Save organization
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground mb-1">Organization name</div>
                <div className="text-sm text-muted-foreground">{org?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-foreground mb-1">Organization slug</div>
                <div className="text-sm text-muted-foreground">{org?.slug ?? '—'}</div>
              </div>
              <p className="text-xs text-muted-foreground">Only organization owners and admins can edit these fields.</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Enrichment credit balance</div>
              <div className="text-sm text-muted-foreground">{(org?.enrichment_credit_balance ?? 0).toLocaleString()} credits</div>
            </div>
            <a
              href="/billing"
              className="bg-muted text-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-muted/70 transition border border-border"
            >
              Manage Billing
            </a>
          </div>
        </section>

        {/* Sending mailboxes (cold email) */}
        <MailboxesSection />

        {/* API keys (LinkedIn Copilot extension) */}
        <ApiKeysSection />
      </div>
    </div>
  );
}
