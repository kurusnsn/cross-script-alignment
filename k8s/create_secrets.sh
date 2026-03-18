#!/bin/bash
# Fill these values from your .env file
DATABASE_URL=""
JWT_SECRET=""
STRIPE_API_KEY=""
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
POSTHOG_API_KEY="phc_5oPuWCFIHUdX4UdlnG64TMvUNwoTIXHWizkGifAH0ne"
POSTHOG_HOST="https://app.posthog.com"

kubectl create secret generic align-secrets -n align \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=STRIPE_API_KEY="$STRIPE_API_KEY" \
  --from-literal=SUPABASE_URL="$SUPABASE_URL" \
  --from-literal=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --from-literal=POSTHOG_API_KEY="$POSTHOG_API_KEY" \
  --from-literal=POSTHOG_HOST="$POSTHOG_HOST"
