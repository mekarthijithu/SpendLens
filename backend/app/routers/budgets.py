from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

@router.get("/", response_model=List[schemas.BudgetResponse])
def get_budgets(month: Optional[str] = None, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    if not month:
        import datetime
        month = datetime.datetime.utcnow().strftime("%Y-%m")
        
    budgets = db.query(models.Budget).filter(
        models.Budget.room_id == current_user.room_id,
        models.Budget.month == month
    ).all()
    
    return budgets

@router.post("/", response_model=schemas.BudgetResponse)
def set_budget(budget_data: schemas.BudgetCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    # Check if budget already exists for this room, category, and month
    existing = db.query(models.Budget).filter(
        models.Budget.room_id == current_user.room_id,
        models.Budget.category == budget_data.category.lower().strip(),
        models.Budget.month == budget_data.month
    ).first()
    
    if existing:
        existing.monthly_limit = budget_data.monthly_limit
        db.commit()
        db.refresh(existing)
        return existing
        
    db_budget = models.Budget(
        room_id=current_user.room_id,
        category=budget_data.category.lower().strip(),
        monthly_limit=budget_data.monthly_limit,
        month=budget_data.month
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget
