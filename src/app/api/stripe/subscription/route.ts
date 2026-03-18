import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth'
import { queryOne } from '@/lib/database'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from '@/lib/devAuth'

interface UserRow {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  is_pro: boolean
}

/**
 * GET /api/stripe/subscription
 * Fetch the current user's subscription details from Stripe
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return unauthorizedResponse()

    if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
      return NextResponse.json({
        plan: 'annual',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_devmock123',
        subscriptionId: 'sub_devmock123',
      })
    }

    const row = await queryOne<UserRow>(
      `SELECT stripe_customer_id, stripe_subscription_id, is_pro
       FROM users
       WHERE supabase_id::text = $1 OR id::text = $1`,
      [user.id]
    )

    if (!row?.stripe_customer_id) {
      return NextResponse.json({
        plan: 'none',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
      })
    }

    const stripe = getStripe()

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: row.stripe_customer_id,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        plan: 'none',
        status: 'inactive',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: row.stripe_customer_id,
      })
    }

    const sub = subscriptions.data[0]
    const priceId = sub.items.data[0]?.price?.id

    // Determine plan based on price ID
    let plan: 'monthly' | 'annual' | 'unknown' = 'unknown'
    if (priceId === STRIPE_PRICES.monthly) plan = 'monthly'
    else if (priceId === STRIPE_PRICES.annual) plan = 'annual'

    return NextResponse.json({
      plan,
      status: sub.status, // active, trialing, canceled, past_due, etc.
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: (sub as any).cancel_at_period_end,
      stripeCustomerId: row.stripe_customer_id,
      subscriptionId: sub.id,
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/stripe/subscription
 * Cancel the user's subscription at period end
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return unauthorizedResponse()

    if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
      return NextResponse.json({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    const row = await queryOne<UserRow>(
      `SELECT stripe_customer_id, stripe_subscription_id, is_pro
       FROM users
       WHERE supabase_id::text = $1 OR id::text = $1`,
      [user.id]
    )

    if (!row?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    const stripe = getStripe()

    // Cancel at period end (graceful — keeps access until billing cycle ends)
    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({
      status: updated.status,
      cancelAtPeriodEnd: (updated as any).cancel_at_period_end,
      currentPeriodEnd: new Date((updated as any).current_period_end * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Subscription cancel error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/stripe/subscription
 * Switch plan (monthly ↔ annual) for existing subscribers
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    const { plan } = body

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "monthly" or "annual".' },
        { status: 400 }
      )
    }

    if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
      return NextResponse.json({
        plan,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      })
    }

    const row = await queryOne<UserRow>(
      `SELECT stripe_customer_id, stripe_subscription_id, is_pro
       FROM users
       WHERE supabase_id::text = $1 OR id::text = $1`,
      [user.id]
    )

    if (!row?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription to switch' },
        { status: 404 }
      )
    }

    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    const itemId = subscription.items.data[0]?.id

    if (!itemId) {
      return NextResponse.json(
        { error: 'Subscription has no items' },
        { status: 500 }
      )
    }

    const newPriceId = plan === 'annual' ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly

    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    })

    const updatedPriceId = updated.items.data[0]?.price?.id
    let updatedPlan: 'monthly' | 'annual' | 'unknown' = 'unknown'
    if (updatedPriceId === STRIPE_PRICES.monthly) updatedPlan = 'monthly'
    else if (updatedPriceId === STRIPE_PRICES.annual) updatedPlan = 'annual'

    return NextResponse.json({
      plan: updatedPlan,
      status: updated.status,
      currentPeriodEnd: new Date((updated as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: (updated as any).cancel_at_period_end,
    })
  } catch (error) {
    console.error('Subscription switch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to switch plan' },
      { status: 500 }
    )
  }
}
