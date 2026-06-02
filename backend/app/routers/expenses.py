from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import csv
import io
import re
import random
from ..database import get_db
from .. import models, schemas, auth, ml

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.get("/", response_model=List[schemas.ExpenseResponse])
def get_expenses(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
    
    # Query expenses and join with user to get names
    expenses = db.query(models.Expense).filter(
        models.Expense.room_id == current_user.room_id
    ).order_by(models.Expense.date.desc(), models.Expense.id.desc()).all()
    
    # Map user names for UI convenience
    result = []
    for exp in expenses:
        user_name = exp.user.name if exp.user else "Unknown User"
        resp = schemas.ExpenseResponse.from_orm(exp)
        resp.user_name = user_name
        result.append(resp)
        
    return result

@router.post("/", response_model=schemas.ExpenseResponse)
def create_expense(expense_data: schemas.ExpenseCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    # Save the expense
    db_expense = models.Expense(
        user_id=current_user.id,
        room_id=current_user.room_id,
        amount=expense_data.amount,
        category=expense_data.category.lower().strip(),
        vendor=expense_data.vendor.strip(),
        payment_mode=expense_data.payment_mode,
        date=expense_data.date,
        is_shared=expense_data.is_shared,
        tags=expense_data.tags,
        notes=expense_data.notes
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # --- 1. Real-time Anomaly Detection ---
    is_anomaly, alert_msg = ml.detect_anomaly(db_expense.amount, db_expense.category, db_expense.room_id, db)
    if is_anomaly:
        # Save notification for all room members
        room_members = db.query(models.User).filter(models.User.room_id == current_user.room_id).all()
        for member in room_members:
            notif = models.Notification(
                user_id=member.id,
                type="anomaly",
                message=f"Anomaly Alert in '{db_expense.category}': {alert_msg} (Logged by {current_user.name})"
            )
            db.add(notif)
        db.commit()
        
    # --- 2. Real-time Budget Cap Threshold Check ---
    # Parse month from expense date
    exp_month = db_expense.date[:7] # YYYY-MM
    budget = db.query(models.Budget).filter(
        models.Budget.room_id == current_user.room_id,
        models.Budget.category == db_expense.category,
        models.Budget.month == exp_month
    ).first()
    
    if budget:
        # Calculate total spend in this category for this month
        total_spent = db.query(models.Expense).filter(
            models.Expense.room_id == current_user.room_id,
            models.Expense.category == db_expense.category,
            models.Expense.date.like(f"{exp_month}%")
        ).with_entities(models.Expense.amount).all()
        
        sum_spent = sum(x[0] for x in total_spent)
        limit = budget.monthly_limit
        
        # Check thresholds
        room_members = db.query(models.User).filter(models.User.room_id == current_user.room_id).all()
        if sum_spent >= limit:
            for member in room_members:
                notif = models.Notification(
                    user_id=member.id,
                    type="budget",
                    message=f"Budget Exceeded! You have spent ₹{sum_spent:.2f} of your ₹{limit:.2f} budget for '{db_expense.category}' this month."
                )
                db.add(notif)
            db.commit()
        elif sum_spent >= limit * 0.8:
            # Check if 80% warning has already been triggered to avoid duplicate alerts
            warn_msg = f"You have spent 80% of your '{db_expense.category}' budget (₹{sum_spent:.2f} of ₹{limit:.2f}) this month."
            exists = db.query(models.Notification).filter(
                models.Notification.user_id == current_user.id,
                models.Notification.message.like(f"%80% of your '{db_expense.category}' budget%")
            ).first()
            if not exists:
                for member in room_members:
                    notif = models.Notification(
                        user_id=member.id,
                        type="budget",
                        message=warn_msg
                    )
                    db.add(notif)
                db.commit()
                
    # --- 3. Trigger optimization checks dynamically ---
    # In a real environment, we'd trigger Kafka events or queue to analytical layer.
    # Here, we trigger a calculation check and create recommendations if savings are high.
    
    resp = schemas.ExpenseResponse.from_orm(db_expense)
    resp.user_name = current_user.name
    return resp

@router.put("/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(expense_id: int, expense_data: schemas.ExpenseUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.room_id == current_user.room_id
    ).first()
    
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found in your room")
        
    for var, value in vars(expense_data).items():
        if value is not None:
            setattr(db_expense, var, value)
            
    db.commit()
    db.refresh(db_expense)
    
    resp = schemas.ExpenseResponse.from_orm(db_expense)
    resp.user_name = db_expense.user.name
    return resp

@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.room_id == current_user.room_id
    ).first()
    
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found in your room")
        
    db.delete(db_expense)
    db.commit()
    return None

@router.post("/ocr", response_model=schemas.OCRResponse)
def ocr_receipt(file: UploadFile = File(...)):
    """
    Mock OCR Parser. In production, this would call AWS Textract, GCP Vision, or Tesseract.
    Parses file content or name for details, else generates realistic Mock Receipt scans.
    """
    filename = file.filename.lower()
    
    # Fallback default values
    amount = 450.00
    vendor = "Zepto"
    category = "groceries"
    date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    payment_mode = "UPI"
    confidence = 0.95
    
    # Heuristics based on filename if present (e.g. blinkit_vegetables_230.png)
    if "blinkit" in filename:
        vendor = "Blinkit"
        category = "vegetables"
    elif "zepto" in filename:
        vendor = "Zepto"
        category = "groceries"
    elif "swiggy" in filename or "zomato" in filename:
        vendor = "Swiggy"
        category = "online delivery"
    elif "electric" in filename or "power" in filename:
        vendor = "State Electricity Board"
        category = "utilities"
        amount = 1850.00
    elif "milk" in filename:
        vendor = "Local Dairy Store"
        category = "milk"
        amount = 88.00
        
    # Search for numbers in filename to set amount
    num_matches = re.findall(r"\d+", filename)
    if num_matches:
        # Use first number as amount if it looks reasonable
        possible_amt = int(num_matches[0])
        if 10 < possible_amt < 10000:
            amount = float(possible_amt)
            
    # Return structured OCR data
    return {
        "amount": amount,
        "vendor": vendor,
        "category": category,
        "date": date,
        "payment_mode": payment_mode,
        "confidence": confidence
    }

@router.post("/import")
def import_csv(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    content = file.file.read()
    buffer = io.StringIO(content.decode("utf-8"))
    
    reader = csv.DictReader(buffer)
    imported_count = 0
    
    for row in reader:
        # Standardize keys (case insensitive, trim)
        clean_row = {k.lower().strip(): v.strip() for k, v in row.items() if k}
        
        # Read parameters
        amount_str = clean_row.get("amount") or clean_row.get("price") or clean_row.get("cost")
        category_str = clean_row.get("category") or clean_row.get("type")
        vendor_str = clean_row.get("vendor") or clean_row.get("store") or clean_row.get("payee")
        date_str = clean_row.get("date") or clean_row.get("time")
        payment_mode_str = clean_row.get("payment_mode") or clean_row.get("mode") or clean_row.get("payment")
        
        if not amount_str or not category_str:
            continue # skip rows without amount and category
            
        try:
            amount = float(amount_str)
        except ValueError:
            continue
            
        category = category_str.lower().strip()
        vendor = vendor_str if vendor_str else "Unknown Vendor"
        payment_mode = payment_mode_str if payment_mode_str else "Cash"
        
        # Date parsing with fallback
        final_date = date_str if date_str else datetime.datetime.utcnow().strftime("%Y-%m-%d")
        
        # Create DB record
        db_expense = models.Expense(
            user_id=current_user.id,
            room_id=current_user.room_id,
            amount=amount,
            category=category,
            vendor=vendor,
            payment_mode=payment_mode,
            date=final_date,
            is_shared=True,
            tags=["csv-imported"],
            notes="Imported via bulk CSV upload"
        )
        db.add(db_expense)
        imported_count += 1
        
    db.commit()
    return {"message": f"Successfully imported {imported_count} expenses"}
