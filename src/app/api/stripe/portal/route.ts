import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from '@/lib/devAuth'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    const { customerId, returnUrl } = body

    if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
      return NextResponse.json({
        url: returnUrl || `${request.headers.get('origin')}/dashboard/settings`,
      })
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing customerId' },
        { status: 400 }
      )
    }

    // Create Stripe customer portal session
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${request.headers.get('origin')}/dashboard/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
