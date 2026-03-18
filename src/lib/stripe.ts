import Stripe from 'stripe'

// Lazy-initialized Stripe client to avoid build-time errors
let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Add it to .env.local')
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    })
  }
  return stripeClient
}

// Product/Price IDs - Update these after creating products in Stripe Dashboard
// Or use the Stripe CLI to create them: stripe products create --name="TranslitAI Monthly"
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
  annual: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_placeholder',
}

// Pricing constants (for display)
export const PRICING = {
  monthly: 1.99,
  annual: 19.10, // $1.99 * 12 * 0.8 (20% off)
  annualMonthly: 1.59, // monthly equivalent
}

// Trial period in days
export const TRIAL_DAYS = 7

