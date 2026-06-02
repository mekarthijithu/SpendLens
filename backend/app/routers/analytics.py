from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
import pandas as pd
import io
from ..database import get_db
from .. import models, schemas, auth, ml

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/summary")
def get_analytics_summary(month: Optional[str] = None, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        raise HTTPException(status_code=400, detail="User is not in any room")
        
    if not month:
        month = datetime.datetime.utcnow().strftime("%Y-%m")
        
    # Get room and members
    room = db.query(models.Room).filter(models.Room.id == current_user.room_id).first()
    members = room.members
    member_map = {m.id: m.name for m in members}
    member_upi = {m.id: m.upi_id for m in members}
    member_avatar = {m.id: m.avatar for m in members}
    
    # 1. Fetch current month expenses
    expenses = db.query(models.Expense).filter(
        models.Expense.room_id == current_user.room_id,
        models.Expense.date.like(f"{month}%")
    ).all()
    
    total_spend = sum(e.amount for e in expenses)
    shared_spend = sum(e.amount for e in expenses if e.is_shared)
    
    # User paid breakdown
    user_paid = {m.id: 0.0 for m in members}
    for e in expenses:
        if e.user_id in user_paid:
            user_paid[e.user_id] += e.amount
            
    user_breakdown = []
    for m in members:
        user_breakdown.append({
            "user_id": m.id,
            "name": m.name,
            "avatar": m.avatar,
            "upi_id": m.upi_id,
            "total_paid": round(user_paid[m.id], 2)
        })
        
    # 2. Category-wise pie chart
    category_totals = {}
    for e in expenses:
        category_totals[e.category] = category_totals.get(e.category, 0.0) + e.amount
        
    category_share = []
    for cat, amt in category_totals.items():
        pct = (amt / total_spend * 100) if total_spend > 0 else 0
        category_share.append({
            "category": cat,
            "amount": round(amt, 2),
            "percentage": round(pct, 2)
        })
        
    # Sort categories by spend descending
    category_share = sorted(category_share, key=lambda x: x["amount"], reverse=True)
    
    # 3. Vendor-level spend
    vendor_totals = {}
    for e in expenses:
        vendor_name = e.vendor.strip() or "Local Vendor"
        vendor_totals[vendor_name] = vendor_totals.get(vendor_name, 0.0) + e.amount
        
    vendor_breakdown = []
    for vend, amt in vendor_totals.items():
        vendor_breakdown.append({
            "vendor": vend,
            "amount": round(amt, 2)
        })
    vendor_breakdown = sorted(vendor_breakdown, key=lambda x: x["amount"], reverse=True)[:8] # Top 8 vendors
    
    # 4. Fairness ledger and settlements (Shared expenses only)
    num_members = len(members)
    avg_share = shared_spend / num_members if num_members > 0 else 0.0
    
    # Calculate shared expense paid per user
    user_shared_paid = {m.id: 0.0 for m in members}
    for e in expenses:
        if e.is_shared and e.user_id in user_shared_paid:
            user_shared_paid[e.user_id] += e.amount
            
    balances = []
    debtors = [] # users who paid less than average [ (id, name, amount_owed) ]
    creditors = [] # users who paid more than average [ (id, name, amount_to_receive) ]
    
    for m in members:
        paid = user_shared_paid[m.id]
        bal = paid - avg_share
        balances.append({
            "user_id": m.id,
            "name": m.name,
            "paid_shared": round(paid, 2),
            "balance": round(bal, 2)
        })
        
        if bal < -0.01:
            debtors.append((m.id, m.name, -bal))
        elif bal > 0.01:
            creditors.append((m.id, m.name, bal))
            
    # Calculate non-confrontational settlements
    # Simple algorithm: match debtors and creditors
    settlements = []
    debtor_idx = 0
    creditor_idx = 0
    
    # Copy lists to edit
    debtors_work = [list(d) for d in debtors]
    creditors_work = [list(c) for c in creditors]
    
    while debtor_idx < len(debtors_work) and creditor_idx < len(creditors_work):
        d_id, d_name, d_owed = debtors_work[debtor_idx]
        c_id, c_name, c_credit = creditors_work[creditor_idx]
        
        transfer_amt = min(d_owed, c_credit)
        if transfer_amt > 0.05:
            settlements.append({
                "from_user_id": d_id,
                "from_user": d_name,
                "to_user_id": c_id,
                "to_user": c_name,
                "amount": round(transfer_amt, 2),
                "upi_id": member_upi.get(c_id) or f"{c_name.lower().replace(' ', '')}@upi"
            })
            
        # Deduct
        debtors_work[debtor_idx][2] -= transfer_amt
        creditors_work[creditor_idx][2] -= transfer_amt
        
        if debtors_work[debtor_idx][2] <= 0.05:
            debtor_idx += 1
        if creditors_work[creditor_idx][2] <= 0.05:
            creditor_idx += 1

    fairness_ledger = {
        "average_share": round(avg_share, 2),
        "balances": balances,
        "settlements": settlements
    }
    
    # 5. 6-Month Category Trends
    # Compute active categories
    active_cats = list(category_totals.keys())
    if not active_cats:
        active_cats = ["groceries", "online delivery", "utilities", "rent", "milk", "vegetables", "miscellaneous"]
        
    # Get last 6 months list (excluding next month)
    months_list = []
    current_dt = datetime.datetime.strptime(month + "-01", "%Y-%m-%d")
    for i in range(5, -1, -1):
        m_dt = current_dt - datetime.timedelta(days=i*30.5) # approximate
        months_list.append(m_dt.strftime("%Y-%m"))
        
    # Deduplicate and sort
    months_list = sorted(list(set(months_list)))
    
    # Ensure active month is the last one in our history range
    if month not in months_list:
        months_list.append(month)
    months_list = months_list[-6:]
    
    # Query all history for these months
    historical_expenses = db.query(models.Expense).filter(
        models.Expense.room_id == current_user.room_id
    ).all()
    
    hist_data = []
    for he in historical_expenses:
        hist_month = he.date[:7]
        if hist_month in months_list:
            hist_data.append({
                "month": hist_month,
                "category": he.category,
                "amount": he.amount
            })
            
    hist_df = pd.DataFrame(hist_data)
    
    trends = []
    for m in months_list:
        m_trend = {"month": m}
        # Populate each category
        for cat in active_cats:
            if not hist_df.empty:
                cat_m_spend = hist_df[(hist_df["month"] == m) & (hist_df["category"] == cat)]["amount"].sum()
                m_trend[cat] = float(cat_m_spend)
            else:
                m_trend[cat] = 0.0
        trends.append(m_trend)
        
    # 6. Next Month Predictions
    predictions = ml.generate_predictions(current_user.room_id, db)
    
    # Append predictions onto the trend timeline (with lower and upper limits as confidence intervals)
    # We will format this so the frontend can draw it as a dotted extension with shaded intervals!
    if predictions:
        pred_month = predictions[0]["month"]
        pred_trend = {"month": pred_month, "is_prediction": True}
        pred_ci_lower = {"month": pred_month, "is_prediction": True}
        pred_ci_upper = {"month": pred_month, "is_prediction": True}
        
        for p in predictions:
            cat = p["category"]
            pred_trend[cat] = p["predicted_amount"]
            pred_ci_lower[cat] = p["confidence_lower"]
            pred_ci_upper[cat] = p["confidence_upper"]
            
        # We'll pack the prediction info clearly for the graph
        prediction_band = {
            "month": pred_month,
            "forecasts": pred_trend,
            "lower_bounds": pred_ci_lower,
            "upper_bounds": pred_ci_upper
        }
    else:
        prediction_band = None
        
    # 7. Optimization suggestions
    optimizations = ml.generate_optimizations(current_user.room_id, db)
    total_avoidable_spend = sum(opt["savings_potential"] for opt in optimizations)
    
    return {
        "month": month,
        "total_spend": round(total_spend, 2),
        "shared_spend": round(shared_spend, 2),
        "user_breakdown": user_breakdown,
        "category_share": category_share,
        "vendor_breakdown": vendor_breakdown,
        "fairness_ledger": fairness_ledger,
        "trends": trends,
        "prediction_band": prediction_band,
        "predictions": predictions,
        "optimizations": optimizations,
        "avoidable_spend_estimate": round(total_avoidable_spend, 2)
    }

@router.get("/export/pdf")
def export_pdf(token: str, month: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        from jose import jwt
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user or not current_user.room_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    if not month:
        month = datetime.datetime.utcnow().strftime("%Y-%m")
        
    summary = get_analytics_summary(month, current_user, db)
    
    # Generate PDF using ReportLab
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=12
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=24
    )
    
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=14,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155')
    )
    
    # Header
    story.append(Paragraph("SpendLens Monthly Household Report", title_style))
    story.append(Paragraph(f"Room: {current_user.room.name} | Statement Month: {month} | Generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Summary Info
    story.append(Paragraph("Financial Summary", h2_style))
    story.append(Paragraph(f"Total Household Spend: <b>INR {summary['total_spend']:.2f}</b>", body_style))
    story.append(Paragraph(f"Shared Expenses: <b>INR {summary['shared_spend']:.2f}</b>", body_style))
    story.append(Paragraph(f"Avoidable Spending: <b>INR {summary['avoidable_spend_estimate']:.2f}</b>", body_style))
    story.append(Spacer(1, 12))
    
    # Contribution ledger Table
    story.append(Paragraph("Member Contribution Ledger", h2_style))
    ledger_data = [["Member", "Shared Spend Paid", "Fair Share (Average)", "Net Balance"]]
    for b in summary['fairness_ledger']['balances']:
        bal_str = f"+{b['balance']:.2f}" if b['balance'] >= 0 else f"{b['balance']:.2f}"
        ledger_data.append([b['name'], f"INR {b['paid_shared']:.2f}", f"INR {summary['fairness_ledger']['average_share']:.2f}", f"INR {bal_str}"])
        
    t1 = Table(ledger_data, colWidths=[150, 120, 120, 120])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
    ]))
    story.append(t1)
    story.append(Spacer(1, 14))
    
    # Settlements
    story.append(Paragraph("Settlement Suggestions", h2_style))
    if not summary['fairness_ledger']['settlements']:
        story.append(Paragraph("All members are fully settled. No payments required.", body_style))
    else:
        for s in summary['fairness_ledger']['settlements']:
            story.append(Paragraph(f"• <b>{s['from_user']}</b> should transfer <b>INR {s['amount']:.2f}</b> to <b>{s['to_user']}</b> (UPI: {s['upi_id']})", body_style))
            
    story.append(Spacer(1, 14))
    
    # Category Breakdown Table
    story.append(Paragraph("Category Spending Breakdown", h2_style))
    cat_data = [["Category", "Amount Spent", "Percentage Share"]]
    for c in summary['category_share']:
        cat_data.append([c['category'].capitalize(), f"INR {c['amount']:.2f}", f"{c['percentage']:.1f}%"])
        
    t2 = Table(cat_data, colWidths=[200, 150, 160])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    story.append(t2)
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=spendlens_report_{month}.pdf"}
    )

@router.get("/export/excel")
def export_excel(token: str, month: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        from jose import jwt
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user or not current_user.room_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    if not month:
        month = datetime.datetime.utcnow().strftime("%Y-%m")
        
    # Get room expenses for that month
    expenses = db.query(models.Expense).filter(
        models.Expense.room_id == current_user.room_id,
        models.Expense.date.like(f"{month}%")
    ).all()
    
    # Summary
    summary = get_analytics_summary(month, current_user, db)
    
    # Build Dataframes
    # 1. Expense logs
    exp_list = []
    for e in expenses:
        exp_list.append({
            "Date": e.date,
            "Category": e.category.capitalize(),
            "Vendor": e.vendor,
            "Amount (INR)": e.amount,
            "Paid By": e.user.name,
            "Payment Mode": e.payment_mode,
            "Is Shared": "Yes" if e.is_shared else "No",
            "Notes": e.notes or ""
        })
    df_expenses = pd.DataFrame(exp_list)
    
    # 2. Ledger balance
    ledger_list = []
    for b in summary['fairness_ledger']['balances']:
        ledger_list.append({
            "Member": b['name'],
            "Shared Paid (INR)": b['paid_shared'],
            "Fair Share (INR)": summary['fairness_ledger']['average_share'],
            "Net Balance (INR)": b['balance']
        })
    df_ledger = pd.DataFrame(ledger_list)
    
    # 3. Category share
    cat_list = []
    for c in summary['category_share']:
        cat_list.append({
            "Category": c['category'].capitalize(),
            "Amount (INR)": c['amount'],
            "Share (%)": c['percentage']
        })
    df_categories = pd.DataFrame(cat_list)
    
    # Write to Excel in memory
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df_ledger.to_excel(writer, sheet_name="Ledger & Balance", index=False)
        df_categories.to_excel(writer, sheet_name="Category Share", index=False)
        if not df_expenses.empty:
            df_expenses.to_excel(writer, sheet_name="All Expenses Log", index=False)
            
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=spendlens_report_{month}.xlsx"}
    )
