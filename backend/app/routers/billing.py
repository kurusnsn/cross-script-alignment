from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.persistence_models import User
from app.services.auth_service import get_current_user
from app.services.billing_service import create_checkout_session, construct_event
from app.utils.config import get_settings
import stripe

router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()


class CheckoutRequest(BaseModel):
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.post("/create-checkout-session", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for Pro subscription"""
    try:
        session = create_checkout_session(
            user_id=str(current_user.id),
            email=current_user.email,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
        )
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = construct_event(payload.decode(), sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle checkout.session.completed
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id") # This is now the Supabase UUID
        subscription_id = session.get("subscription")
        
        if user_id:
            # Try lookup by supabase_id first
            user = db.query(User).filter(User.supabase_id == user_id).first()
            if not user:
                # Fallback to email lookup if metadata has it or use id if legacy
                try:
                    user = db.query(User).filter(User.id == int(user_id)).first()
                except (ValueError, TypeError):
                    pass
            
            if user:
                user.stripe_customer_id = session.get("customer")
                user.stripe_subscription_id = subscription_id
                user.is_pro = True
                db.commit()
    
    # Handle subscription.deleted (cancellation)
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.is_pro = False
            user.stripe_subscription_id = None
            db.commit()
    
    return {"status": "success"}


@router.get("/subscription-status")
async def get_subscription_status(current_user: User = Depends(get_current_user)):
    """Get current user's subscription status"""
    return {
        "is_pro": current_user.is_pro,
        "stripe_customer_id": current_user.stripe_customer_id,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }
