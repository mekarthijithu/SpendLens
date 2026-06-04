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

@router.get("/pool", response_model=List[schemas.PoolContributionResponse])
def get_pool_contributions(month: Optional[str] = None, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    if not month:
        import datetime
        month = datetime.datetime.utcnow().strftime("%Y-%m")
        
    contributions = db.query(models.PoolContribution).filter(
        models.PoolContribution.room_id == current_user.room_id,
        models.PoolContribution.month == month
    ).all()
    
    # Map user name
    result = []
    for c in contributions:
        resp = schemas.PoolContributionResponse.from_orm(c)
        resp.user_name = c.user.name if c.user else "Unknown Member"
        result.append(resp)
        
    return result

@router.post("/pool", response_model=schemas.PoolContributionResponse)
def add_pool_contribution(contribution_data: schemas.PoolContributionCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    # Check if the target user is in the same room
    contributing_user = db.query(models.User).filter(
        models.User.id == contribution_data.user_id,
        models.User.room_id == current_user.room_id
    ).first()
    
    if not contributing_user:
        raise HTTPException(status_code=400, detail="User not found in this room")
        
    db_contribution = models.PoolContribution(
        room_id=current_user.room_id,
        user_id=contribution_data.user_id,
        amount=contribution_data.amount,
        month=contribution_data.month
    )
    db.add(db_contribution)
    db.commit()
    db.refresh(db_contribution)
    
    resp = schemas.PoolContributionResponse.from_orm(db_contribution)
    resp.user_name = contributing_user.name
    return resp

@router.delete("/pool/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pool_contribution(contribution_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    db_contribution = db.query(models.PoolContribution).filter(
        models.PoolContribution.id == contribution_id,
        models.PoolContribution.room_id == current_user.room_id
    ).first()
    
    if not db_contribution:
        raise HTTPException(status_code=404, detail="Pool contribution not found")
        
    if db_contribution.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the person assigned to this contribution can delete it")
        
    db.delete(db_contribution)
    db.commit()
    return None
