import { createClient } from '@/utils/supabase/server'
import { createCheckoutSession, createBillingPortalSession } from './actions'
import { redirect } from 'next/navigation'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Normally, we'd fetch the user's organization and subscription from Supabase here
  // Mocking it for now as UI demonstration
  const mockOrgId = "org_123"
  const hasActiveSubscription = false 
  const mockCustomerId = "cus_12345"

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
              <h3 className="text-xs font-medium text-foreground tracking-wide uppercase">What's included</h3>
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
              <form action={createCheckoutSession.bind(null, 'price_pro_id', mockOrgId)}>
                <button type="submit" className="mt-8 block w-full bg-primary border border-transparent rounded-md py-2 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition">
                  Subscribe to Pro
                </button>
              </form>
            </div>
            <div className="pt-6 pb-8 px-6">
              <h3 className="text-xs font-medium text-foreground tracking-wide uppercase">What's included</h3>
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
              Manage Billing & Invoices
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
