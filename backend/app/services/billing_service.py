import stripe
from app.utils.config import get_settings

settings = get_settings()
if settings.stripe_api_key:
    stripe.api_key = settings.stripe_api_key

def create_checkout_session(user_id: str, email: str, success_url: str, cancel_url: str):
    if not stripe.api_key:
        raise Exception("Stripe not configured")
        
    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price': settings.stripe_price_id_pro,
            'quantity': 1,
        }],
        mode='subscription',
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=email,
        metadata={
            'user_id': user_id
        }
    )
    return session

def construct_event(payload: str, sig_header: str):
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
