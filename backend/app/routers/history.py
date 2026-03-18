from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.persistence_models import HistoryItem, Folder
from app.services.auth_service import get_current_user
from pydantic import BaseModel
from sqlalchemy import or_

router = APIRouter(prefix="/history", tags=["history"])

class HistoryCreate(BaseModel):
    original: str
    aligneration: str
    translation: str
    ipa: Optional[str] = None
    alignment_data: Optional[dict] = None
    result_json: Optional[dict] = None
    folder_id: Optional[int] = None

class FolderCreate(BaseModel):
    name: str

class FolderResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class HistoryResponse(BaseModel):
    id: int
    original: str
    aligneration: str
    translation: str
    ipa: Optional[str] = None
    alignment_data: Optional[dict] = None
    result_json: Optional[dict] = None
    folder_id: Optional[int] = None
    class Config:
        from_attributes = True

@router.get("", response_model=List[HistoryResponse])
def get_history(
    q: Optional[str] = None,
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(HistoryItem).filter(HistoryItem.user_id == current_user.id)
    
    if folder_id:
        query = query.filter(HistoryItem.folder_id == folder_id)
    
    if q:
        query = query.filter(
            or_(
                HistoryItem.original.ilike(f"%{q}%"),
                HistoryItem.translation.ilike(f"%{q}%"),
                HistoryItem.aligneration.ilike(f"%{q}%")
            )
        )
    
    return query.order_by(HistoryItem.created_at.desc()).all()

@router.post("", response_model=HistoryResponse)
def save_history(
    item: HistoryCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_item = HistoryItem(
        **item.dict(),
        user_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/folders", response_model=List[FolderResponse])
def get_folders(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Folder).filter(Folder.user_id == current_user.id).all()

@router.post("/folders", response_model=FolderResponse)
def create_folder(
    folder: FolderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_folder = Folder(name=folder.name, user_id=current_user.id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.patch("/{history_id}/move")
def move_to_folder(
    history_id: int,
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_item = db.query(HistoryItem).filter(HistoryItem.id == history_id, HistoryItem.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="History item not found")
    
    if folder_id:
        db_folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
        if not db_folder:
            raise HTTPException(status_code=404, detail="Folder not found")
    
    db_item.folder_id = folder_id
    db.commit()
    return {"message": "Moved successfully"}
