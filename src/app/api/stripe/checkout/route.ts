import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES, TRIAL_DAYS } from '@/lib/stripe'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { plan, successUrl, cancelUrl, email } = body

    if (!plan) {
      return NextResponse.json(
        { error: 'Missing required field: plan' },
        { status: 400 }
      )
    }

    const priceId = plan === 'annual' ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly

    // Check if price IDs are configured
    if (priceId.includes('placeholder')) {
      return NextResponse.json(
        { error: 'Stripe price IDs not configured. Add STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL to .env.local' },
        { status: 500 }
      )
    }

    // Use authenticated user's ID (Supabase UUID)
    const userId = user.id
    const userEmail = email || user.email

    // Create Stripe checkout session
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          userId: userId,
          plan,
        },
      },
      success_url: successUrl || `${request.headers.get('origin')}/dashboard/settings?success=true`,
      cancel_url: cancelUrl || `${request.headers.get('origin')}/dashboard/settings?canceled=true`,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        plan,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
