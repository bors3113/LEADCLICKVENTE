'use server'

import { stripe } from '@/utils/stripe/server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createCheckoutSession(priceId: string, organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be logged in to subscribe')
  }

  // Get or create Stripe Customer
  // In a real implementation, you might fetch customer ID from organizations table
  
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    customer_email: user.email, // If customer ID is unknown
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    client_reference_id: organizationId,
    success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing`,
  })

  if (session.url) {
    redirect(session.url)
  }
}

// One-time PAYG top-up for enrichment credits. Uses Stripe Payment mode (not subscription).
// priceId should map to a one-time Stripe price; credits granted via the webhook.
export async function createEnrichmentTopupCheckout(priceId: string, organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be logged in to buy enrichment credits')
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    client_reference_id: organizationId,
    metadata: { type: 'enrichment_topup', price_id: priceId },
    success_url: `${origin}/dashboard?topup=success`,
    cancel_url: `${origin}/billing`,
  })

  if (session.url) {
    redirect(session.url)
  }
}

export async function createBillingPortalSession(customerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be logged in to manage billing')
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard`,
  })

  redirect(session.url)
}
