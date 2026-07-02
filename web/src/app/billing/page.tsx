import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { createCheckoutSession, createBillingPortalSession, createEnrichmentTopupCheckout } from './actions';
import { redirect } from 'next/navigation';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await prisma.memberships.findFirst({
    where: { user_id: user.id },
    select: { organization_id: true },
  });
  const orgId = membership?.organization_id ?? user.id;

  const [org, subscription] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: orgId },
      select: { stripe_customer_id: true, enrichment_credit_balance: true },
    }),
    prisma.subscriptions.findFirst({
      where: { organization_id: orgId, status: 'active' },
      select: { status: true },
    }),
  ]);

  const hasActiveSubscription = subscription?.status === 'active';
  const mockCustomerId = org?.stripe_customer_id ?? '';
  const enrichBalance = org?.enrichment_credit_balance ?? 0;

  const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '';
  const enrich500PriceId = process.env.NEXT_PUBLIC_STRIPE_ENRICH_500_PRICE_ID ?? '';
  const enrich2000PriceId = process.env.NEXT_PUBLIC_STRIPE_ENRICH_2000_PRICE_ID ?? '';
  const enrich5000PriceId = process.env.NEXT_PUBLIC_STRIPE_ENRICH_5000_PRICE_ID ?? '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:flex sm:flex-col sm:align-center mb-10">
        <h1 className="text-4xl font-extrabold text-foreground sm:text-center">Pricing Plans</h1>
        <p className="mt-5 text-xl text-muted-foreground sm:text-center">
          Start building for free, then add a site plan to go live.
        </p>
      </div>

      {!hasActiveSubscription ? (
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">

          {/* Free Tier */}
          <div className="border border-border rounded-lg shadow-sm divide-y divide-border bg-background">
            <div className="p-6">
              <h2 className="text-lg leading-6 font-medium text-foreground">Hobby</h2>
              <p className="mt-4 text-sm text-muted-foreground">All the basics for starting a new project.</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-foreground">$0</span>
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <button disabled className="mt-8 block w-full bg-muted border border-border rounded-md py-2 text-sm font-semibold text-foreground text-center opacity-50 cursor-not-allowed">
                Current Plan
              </button>
            </div>
            <div className="pt-6 pb-8 px-6">
              <h3 className="text-xs font-medium text-foreground tracking-wide uppercase">What&apos;s included</h3>
              <ul className="mt-6 space-y-4">
                <li className="flex space-x-3 text-sm text-muted-foreground">
                  <span className="text-green-500">✓</span> 50 Extractions / mo
                </li>
              </ul>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="border border-primary rounded-lg shadow-md divide-y divide-border bg-background relative">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-lg rounded-tr-lg text-xs font-bold uppercase tracking-wider">
              Most Popular
            </div>
            <div className="p-6">
              <h2 className="text-lg leading-6 font-medium text-foreground">Pro</h2>
              <p className="mt-4 text-sm text-muted-foreground">For scaling agencies and power users.</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-foreground">$49</span>
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <form action={createCheckoutSession.bind(null, proPriceId, orgId)}>
                <button type="submit" className="mt-8 block w-full bg-primary border border-transparent rounded-md py-2 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition">
                  Subscribe to Pro
                </button>
              </form>
            </div>
            <div className="pt-6 pb-8 px-6">
              <h3 className="text-xs font-medium text-foreground tracking-wide uppercase">What&apos;s included</h3>
              <ul className="mt-6 space-y-4">
                <li className="flex space-x-3 text-sm text-muted-foreground">
                  <span className="text-green-500">✓</span> 10,000 Extractions / mo
                </li>
                <li className="flex space-x-3 text-sm text-muted-foreground">
                  <span className="text-green-500">✓</span> API Access
                </li>
                <li className="flex space-x-3 text-sm text-muted-foreground">
                  <span className="text-green-500">✓</span> CSV/Excel Exports
                </li>
              </ul>
            </div>
          </div>

        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-background rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Your Subscription</h2>
          <p className="text-muted-foreground mb-6">You are currently subscribed to the Pro plan.</p>

          <form action={createBillingPortalSession.bind(null, mockCustomerId)}>
            <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition">
              Manage Billing &amp; Invoices
            </button>
          </form>
        </div>
      )}

      {/* LinkedIn Enrichment Credit Top-ups */}
      <div className="mt-16">
        <div className="sm:flex sm:flex-col sm:align-center mb-8">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-center">LinkedIn Data Enrichment</h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-center max-w-2xl mx-auto">
            Enrich your scraped Google Maps leads with LinkedIn data — employee
            lists and individual profiles. Pay only for what you successfully enrich.
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-center">
            Current PAYG balance: <span className="font-semibold text-foreground">{enrichBalance.toLocaleString()} credits</span>
          </p>
        </div>

        {/* Credit cost reference */}
        <div className="max-w-2xl mx-auto mb-8 bg-muted/30 border border-border rounded-lg p-4 text-sm text-muted-foreground grid grid-cols-3 gap-4 text-center">
          <div><div className="font-medium text-foreground text-lg">2 credits</div><div>Company employees</div></div>
          <div><div className="font-medium text-foreground text-lg">2 + 3/profile</div><div>Cascade — all / capped</div></div>
          <div><div className="font-medium text-foreground text-lg">2 + 5/profile</div><div>Cascade — decision-makers</div></div>
        </div>

        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:max-w-4xl lg:mx-auto">

          {/* 500 credits */}
          <div className="border border-border rounded-lg shadow-sm divide-y divide-border bg-background">
            <div className="p-6">
              <h3 className="text-lg font-medium text-foreground">Starter Pack</h3>
              <p className="mt-2 text-sm text-muted-foreground">Good for testing enrichment on a campaign.</p>
              <p className="mt-6">
                <span className="text-3xl font-extrabold text-foreground">$8</span>
                <span className="text-sm text-muted-foreground"> one-time</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">500 enrichment credits</p>
              {enrich500PriceId ? (
                <form action={createEnrichmentTopupCheckout.bind(null, enrich500PriceId, orgId)}>
                  <button type="submit" className="mt-6 block w-full bg-primary border border-transparent rounded-md py-2 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition">
                    Buy 500 credits
                  </button>
                </form>
              ) : (
                <button disabled className="mt-6 block w-full bg-muted rounded-md py-2 text-sm font-semibold text-muted-foreground text-center cursor-not-allowed">
                  Coming soon
                </button>
              )}
            </div>
          </div>

          {/* 2000 credits */}
          <div className="border border-primary rounded-lg shadow-md divide-y divide-border bg-background relative">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-lg rounded-tr-lg text-xs font-bold uppercase tracking-wider">
              Best Value
            </div>
            <div className="p-6">
              <h3 className="text-lg font-medium text-foreground">Growth Pack</h3>
              <p className="mt-2 text-sm text-muted-foreground">Enrich a full campaign at scale.</p>
              <p className="mt-6">
                <span className="text-3xl font-extrabold text-foreground">$28</span>
                <span className="text-sm text-muted-foreground"> one-time</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">2,000 enrichment credits</p>
              {enrich2000PriceId ? (
                <form action={createEnrichmentTopupCheckout.bind(null, enrich2000PriceId, orgId)}>
                  <button type="submit" className="mt-6 block w-full bg-primary border border-transparent rounded-md py-2 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition">
                    Buy 2,000 credits
                  </button>
                </form>
              ) : (
                <button disabled className="mt-6 block w-full bg-muted rounded-md py-2 text-sm font-semibold text-muted-foreground text-center cursor-not-allowed">
                  Coming soon
                </button>
              )}
            </div>
          </div>

          {/* 5000 credits */}
          <div className="border border-border rounded-lg shadow-sm divide-y divide-border bg-background">
            <div className="p-6">
              <h3 className="text-lg font-medium text-foreground">Agency Pack</h3>
              <p className="mt-2 text-sm text-muted-foreground">High-volume enrichment for agencies.</p>
              <p className="mt-6">
                <span className="text-3xl font-extrabold text-foreground">$60</span>
                <span className="text-sm text-muted-foreground"> one-time</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">5,000 enrichment credits</p>
              {enrich5000PriceId ? (
                <form action={createEnrichmentTopupCheckout.bind(null, enrich5000PriceId, orgId)}>
                  <button type="submit" className="mt-6 block w-full bg-primary border border-transparent rounded-md py-2 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition">
                    Buy 5,000 credits
                  </button>
                </form>
              ) : (
                <button disabled className="mt-6 block w-full bg-muted rounded-md py-2 text-sm font-semibold text-muted-foreground text-center cursor-not-allowed">
                  Coming soon
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Credits are non-expiring and charged only on successful enrichment. 1 credit ≈ $0.012–0.016 depending on pack.
          Powered by <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="underline">Apify</a>.
        </p>
      </div>
    </div>
  );
}
