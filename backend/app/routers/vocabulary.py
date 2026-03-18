from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.persistence_models import VocabularyItem
from app.services.auth_service import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])

class VocabularyCreate(BaseModel):
    word: str
    aligneration: str
    translation: str
    ipa: Optional[str] = None
    pos: Optional[str] = None
    context: Optional[str] = None

class VocabularyResponse(BaseModel):
    id: int
    word: str
    aligneration: str
    translation: str
    ipa: Optional[str] = None
    pos: Optional[str] = None
    context: Optional[str] = None
    
    class Config:
        from_attributes = True

@router.get("", response_model=List[VocabularyResponse])
def get_vocabulary(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all saved vocabulary items for the current user.
    """
    items = db.query(VocabularyItem).filter(VocabularyItem.user_id == current_user.id).order_by(VocabularyItem.created_at.desc()).all()
    return items

@router.post("", response_model=VocabularyResponse)
def save_vocabulary_item(
    item: VocabularyCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Save a new word to the user's vocabulary.
    """
    # Check if word already exists to avoid duplicates
    existing = db.query(VocabularyItem).filter(
        VocabularyItem.user_id == current_user.id,
        VocabularyItem.word == item.word,
        VocabularyItem.translation == item.translation
    ).first()
    
    if existing:
        return existing

    db_item = VocabularyItem(
        **item.dict(),
        user_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}", status_code=204)
def delete_vocabulary_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete a vocabulary item.
    """
    item = db.query(VocabularyItem).filter(
        VocabularyItem.id == item_id,
        VocabularyItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")
        
    db.delete(item)
    db.commit()
    return None
