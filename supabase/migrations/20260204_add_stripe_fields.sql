-- Migration: Add Stripe fields to users table
-- Created: 2026-02-04

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;

-- Add index on stripe_customer_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
