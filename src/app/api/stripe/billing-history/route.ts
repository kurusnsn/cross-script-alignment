import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth'
import { queryOne } from '@/lib/database'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from '@/lib/devAuth'

interface UserRow {
  stripe_customer_id: string | null
}

/**
 * GET /api/stripe/billing-history
 * Fetch invoice history for the current user from Stripe
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return unauthorizedResponse()

    if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
      return NextResponse.json({
        invoices: [
          {
            id: 'inv_mockdev123',
            date: new Date().toISOString(),
            amount: 99.00,
            currency: 'USD',
            status: 'paid',
            description: 'TranslitAI Pro (Annual)',
            invoicePdf: null,
            hostedUrl: null,
          }
        ]
      })
    }

    const row = await queryOne<UserRow>(
      `SELECT stripe_customer_id FROM users WHERE supabase_id::text = $1 OR id::text = $1`,
      [user.id]
    )

    if (!row?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] })
    }

    const stripe = getStripe()

    const invoices = await stripe.invoices.list({
      customer: row.stripe_customer_id,
      limit: 24,
    })

    const formatted = invoices.data.map((inv) => ({
      id: inv.id,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      amount: (inv.amount_paid ?? 0) / 100, // cents → dollars
      currency: inv.currency?.toUpperCase() || 'USD',
      status: inv.status, // paid, open, draft, void, uncollectible
      description: inv.lines?.data?.[0]?.description || 'TranslitAI Subscription',
      invoicePdf: inv.invoice_pdf || null,
      hostedUrl: inv.hosted_invoice_url || null,
    }))

    return NextResponse.json({ invoices: formatted })
  } catch (error) {
    console.error('Billing history error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch billing history' },
      { status: 500 }
    )
  }
}
