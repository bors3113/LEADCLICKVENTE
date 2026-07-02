'use server';

import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to update your profile');
  }

  const fullName = String(formData.get('full_name') ?? '').trim();
  const avatarUrl = String(formData.get('avatar_url') ?? '').trim();

  await prisma.public_users.update({
    where: { id: user.id },
    data: {
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
    },
  });

  revalidatePath('/dashboard/settings');
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to change your password');
  }

  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/settings');
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to update organization settings');
  }

  const membership = await prisma.memberships.findFirst({
    where: { user_id: user.id },
    select: { organization_id: true, role: true },
  });

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new Error('Only organization owners and admins can update organization settings');
  }

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();

  if (!name || !slug) {
    throw new Error('Organization name and slug are required');
  }

  try {
    await prisma.organizations.update({
      where: { id: membership.organization_id },
      data: { name, slug },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      throw new Error('That organization slug is already taken');
    }
    throw err;
  }

  revalidatePath('/dashboard/settings');
}
