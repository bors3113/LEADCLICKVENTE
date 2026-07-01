import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe/server'
import { createClient } from '@/utils/supabase/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('Stripe-Signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const orgId = session.client_reference_id;

          if (orgId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

            await supabase.from('subscriptions').insert({
              organization_id: orgId,
              stripe_sub_id: subscription.id,
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end
            });

            await supabase.from('organizations').update({
              stripe_customer_id: customerId
            }).eq('id', orgId);
          }
        }

        if (session.mode === 'payment') {
          // One-time PAYG enrichment credit top-up.
          const orgId = session.client_reference_id;
          const priceId = session.metadata?.price_id;

          if (orgId && priceId) {
            // Map Stripe price ID → credit amount to grant.
            // Add entries here as you create top-up products in Stripe.
            const TOPUP_CREDITS: Record<string, number> = {
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_500_PRICE_ID || '']: 500,
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_2000_PRICE_ID || '']: 2000,
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_5000_PRICE_ID || '']: 5000,
            };

            const creditsToAdd = TOPUP_CREDITS[priceId] ?? 0;
            if (creditsToAdd > 0) {
              const { data: org } = await supabase
                .from('organizations')
                .select('enrichment_credit_balance')
                .eq('id', orgId)
                .single();

              const current = (org?.enrichment_credit_balance as number | null) ?? 0;
              await supabase
                .from('organizations')
                .update({ enrichment_credit_balance: current + creditsToAdd })
                .eq('id', orgId);
            }
          }
        }
        break
      }
      
      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any

        await supabase.from('subscriptions').update({
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end
        }).eq('stripe_sub_id', subscription.id)

        // When the billing period rolls over, a new usage_tracking row is naturally
        // created on the next enrichment. No explicit reset needed since the meter
        // is keyed on (organization_id, billing_period_start).
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        await supabase.from('subscriptions').update({
          status: 'canceled',
          cancel_at_period_end: false
        }).eq('stripe_sub_id', subscription.id)
        break
      }
    }
  } catch (err: any) {
    console.error('Error processing webhook:', err)
    return new NextResponse('Webhook handler failed', { status: 500 })
  }

  return new NextResponse('Webhook processed successfully', { status: 200 })
}
