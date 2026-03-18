import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { query } from '@/lib/database'
import Stripe from 'stripe'

// Webhook secret from Stripe Dashboard
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const customerId = session.customer as string
      
      if (userId) {
        // userId is likely the Supabase UUID
        await query(
          'UPDATE users SET stripe_customer_id = $1, is_pro = true WHERE supabase_id::text = $2 OR id::text = $2 OR email = (SELECT email FROM users WHERE supabase_id::text = $2 OR id::text = $2 LIMIT 1)',
          [customerId, userId]
        )
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const status = subscription.status
      const isPro = ['active', 'trialing'].includes(status)
      
      await query(
        'UPDATE users SET is_pro = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3',
        [isPro, subscription.id, customerId]
      )
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      
      await query(
        'UPDATE users SET is_pro = false, stripe_subscription_id = NULL WHERE stripe_customer_id = $1',
        [customerId]
      )
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      
      await query(
        'UPDATE users SET is_pro = false WHERE stripe_customer_id = $1',
        [customerId]
      )
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
