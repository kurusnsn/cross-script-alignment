#!/usr/bin/env bash
# sentry-slack-setup.sh
# Configures Sentry to send alert notifications to Slack via webhook.
#
# Prerequisites:
#   1. A Sentry auth token with project:write scope:
#      https://sentry.io/settings/account/api/auth-tokens/
#   2. Your Sentry org slug and project slug (visible in the Sentry URL:
#      https://sentry.io/organizations/<ORG_SLUG>/projects/<PROJECT_SLUG>/)
#
# Usage:
#   SENTRY_AUTH_TOKEN=sntrys_... SENTRY_ORG=your-org SENTRY_PROJECT=cross-script-alignment ./sentry-slack-setup.sh

set -euo pipefail

SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:?Set SENTRY_AUTH_TOKEN}"
SENTRY_ORG="${SENTRY_ORG:?Set SENTRY_ORG}"
SENTRY_PROJECT="${SENTRY_PROJECT:?Set SENTRY_PROJECT}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:?Set SLACK_WEBHOOK_URL}"
SENTRY_API="https://sentry.io/api/0"

echo "→ Configuring Sentry project alerts for ${SENTRY_ORG}/${SENTRY_PROJECT}"

# ── 1. Create a Slack notification action (webhook) ──────────────────────────
echo "→ Creating Slack notification plugin config..."
curl -sf -X PUT \
  "${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/plugins/webhooks/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"urls\": [\"${SLACK_WEBHOOK_URL}\"]}" \
  | python3 -m json.tool || echo "  (webhook plugin may already be configured)"

# ── 2. Enable the webhook plugin ─────────────────────────────────────────────
curl -sf -X POST \
  "${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/plugins/webhooks/enable/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  | python3 -m json.tool || true

# ── 3. Create alert rule: notify on every new issue ──────────────────────────
echo "→ Creating alert rule: new issue → Slack..."
curl -sf -X POST \
  "${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Notify Slack on new issue",
    "conditions": [
      {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
    ],
    "filters": [],
    "actions": [
      {
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "service": "webhooks"
      }
    ],
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 30
  }' | python3 -m json.tool

# ── 4. Create alert rule: notify on high error volume ────────────────────────
echo "→ Creating alert rule: high error volume → Slack..."
curl -sf -X POST \
  "${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Notify Slack on error spike (>10 events/min)",
    "conditions": [
      {
        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        "value": 10,
        "interval": "1m"
      }
    ],
    "filters": [],
    "actions": [
      {
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "service": "webhooks"
      }
    ],
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 60
  }' | python3 -m json.tool

echo ""
echo "✅ Sentry → Slack configured for ${SENTRY_ORG}/${SENTRY_PROJECT}"
echo "   Notifications will be sent to #alerts via the incoming webhook."
