import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const PRO_MONTHLY_CREDIT_GRANT = 1000;

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const orgId = session.client_reference_id;

          if (orgId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

            await prisma.subscriptions.create({
              data: {
                organization_id: orgId,
                stripe_sub_id: subscription.id,
                status: subscription.status,
                current_period_end: new Date(subscription.current_period_end * 1000),
                cancel_at_period_end: subscription.cancel_at_period_end,
              },
            });

            await prisma.organizations.update({
              where: { id: orgId },
              data: {
                stripe_customer_id: customerId,
                enrichment_credit_balance: { increment: PRO_MONTHLY_CREDIT_GRANT },
              },
            });
          }
        }

        if (session.mode === 'payment') {
          const orgId = session.client_reference_id;
          const priceId = session.metadata?.price_id;

          if (orgId && priceId) {
            const TOPUP_CREDITS: Record<string, number> = {
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_500_PRICE_ID || '']: 500,
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_2000_PRICE_ID || '']: 2000,
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_5000_PRICE_ID || '']: 5000,
              [process.env.NEXT_PUBLIC_STRIPE_ENRICH_10000_PRICE_ID || '']: 10000,
            };

            const creditsToAdd = TOPUP_CREDITS[priceId] ?? 0;
            if (creditsToAdd > 0) {
              await prisma.organizations.update({
                where: { id: orgId },
                data: { enrichment_credit_balance: { increment: creditsToAdd } },
              });
            }
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Only grant credits on renewals — the initial subscription invoice
        // is already covered by checkout.session.completed above, and
        // crediting both would double-grant on signup.
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionRef = invoice.parent?.subscription_details?.subscription;
          const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
          if (subscriptionId) {
            const dbSubscription = await prisma.subscriptions.findUnique({
              where: { stripe_sub_id: subscriptionId },
              select: { organization_id: true },
            });

            if (dbSubscription) {
              await prisma.organizations.update({
                where: { id: dbSubscription.organization_id },
                data: { enrichment_credit_balance: { increment: PRO_MONTHLY_CREDIT_GRANT } },
              });
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;

        await prisma.subscriptions.update({
          where: { stripe_sub_id: subscription.id },
          data: {
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscriptions.update({
          where: { stripe_sub_id: subscription.id },
          data: { status: 'canceled', cancel_at_period_end: false },
        });
        break;
      }
    }
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return new NextResponse('Webhook processed successfully', { status: 200 });
}
