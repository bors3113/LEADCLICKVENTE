import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getOrgId } from '@/lib/org';
import {
  isProvider,
  providerConfigured,
  redirectUri,
  signState,
  GOOGLE,
  MICROSOFT,
  GOOGLE_SCOPES,
  MICROSOFT_SCOPES,
} from '@/lib/email/oauth-config';

// GET /api/mailboxes/connect?provider=google|microsoft
// Builds the provider consent URL and redirects the user to it.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const provider = request.nextUrl.searchParams.get('provider');
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }
  if (!providerConfigured(provider)) {
    return NextResponse.json(
      { error: `${provider} OAuth is not configured on this server.` },
      { status: 501 }
    );
  }

  const organizationId = await getOrgId(supabase, user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organization found for this account' }, { status: 400 });
  }

  const state = signState({ orgId: organizationId, userId: user.id, provider });

  let authUrl: URL;
  if (provider === 'google') {
    authUrl = new URL(GOOGLE.authUrl);
    authUrl.searchParams.set('client_id', GOOGLE.clientId());
    authUrl.searchParams.set('redirect_uri', redirectUri('google'));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent'); // force refresh_token issuance
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', state);
  } else {
    authUrl = new URL(MICROSOFT.authUrl);
    authUrl.searchParams.set('client_id', MICROSOFT.clientId());
    authUrl.searchParams.set('redirect_uri', redirectUri('microsoft'));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', MICROSOFT_SCOPES.join(' '));
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(authUrl.toString());
}
