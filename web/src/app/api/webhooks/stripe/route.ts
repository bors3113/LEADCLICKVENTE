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
          // Handle subscription creation
          // E.g., insert into public.subscriptions
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const orgId = session.client_reference_id; // Passed during checkout session creation
          
          if (orgId) {
            // Retrieve subscription to get period dates and status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

            await supabase.from('subscriptions').insert({
              organization_id: orgId,
              stripe_sub_id: subscription.id,
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end
            });
            
            // Also update the org with customer ID
            await supabase.from('organizations').update({
              stripe_customer_id: customerId
            }).eq('id', orgId);
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
