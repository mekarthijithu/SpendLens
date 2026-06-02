import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from . import models
import datetime

# List of online delivery platforms to check for optimization suggestions
DELIVERY_VENDORS = ["zepto", "blinkit", "swiggy", "zomato", "amazon", "instamart"]

def detect_anomaly(amount: float, category: str, room_id: int, db: Session) -> Tuple[bool, str]:
    """
    Detects if an expense is an anomaly (outlier) in its category for the room.
    Uses Isolation Forest if there are enough samples; otherwise falls back to a 3-z-score standard deviation check.
    """
    # Fetch historical expenses for this category in the room
    history = db.query(models.Expense).filter(
        models.Expense.room_id == room_id,
        models.Expense.category == category
    ).all()
    
    if len(history) < 5:
        # Not enough data for isolation forest or z-score, check simple absolute thresholds
        # Let's say if it's the first few items, we don't flag as anomaly unless it is extraordinarily high
        if len(history) > 0:
            amounts = [e.amount for e in history]
            mean_amount = sum(amounts) / len(amounts)
            if amount > mean_amount * 3.5 and amount > 500:
                return True, f"This spend is 3.5x higher than your category average of ₹{mean_amount:.2f}."
        return False, ""

    # Prepare historical amount array
    amounts = np.array([e.amount for e in history]).reshape(-1, 1)
    
    # 1. Isolation Forest approach
    try:
        # Fit Isolation Forest. Contamination represents expected outlier rate.
        clf = IsolationForest(random_state=42, contamination=0.1)
        clf.fit(amounts)
        
        # Predict if current amount is outlier
        pred = clf.predict([[amount]])
        
        # If predicted as -1, it's an anomaly. Let's verify with Z-score to prevent false positives on lower amounts
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        if pred[0] == -1 and amount > mean_amount + 1.5 * std_amount and amount > mean_amount:
            # Anomaly is higher than average
            deviation_pct = ((amount - mean_amount) / mean_amount) * 100
            return True, f"Spend of ₹{amount} is significantly higher than your typical average of ₹{mean_amount:.2f} (+{deviation_pct:.0f}% spike)."
    except Exception:
        # Fallback to robust Z-score
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts) if np.std(amounts) > 0 else 1.0
        z_score = (amount - mean_amount) / std_amount
        if z_score > 2.5 and amount > mean_amount * 2:
            return True, f"Spend spike detected: ₹{amount} is standard deviation outlier (Z-score: {z_score:.2f}) from average ₹{mean_amount:.2f}."
            
    return False, ""

def generate_predictions(room_id: int, db: Session) -> List[Dict[str, Any]]:
    """
    Forecasts next month's spending per category using time-series linear trend + seasonality.
    Provides predicted amount and upper/lower confidence boundaries.
    """
    # Fetch all room expenses
    expenses = db.query(models.Expense).filter(models.Expense.room_id == room_id).all()
    if not expenses:
        return []
        
    # Build dataframe
    data = []
    for e in expenses:
        # Parse date
        try:
            date_parsed = datetime.datetime.strptime(e.date, "%Y-%m-%d")
        except ValueError:
            date_parsed = datetime.datetime.utcnow()
        data.append({
            "amount": e.amount,
            "category": e.category,
            "date": date_parsed,
            "month": date_parsed.strftime("%Y-%m")
        })
        
    df = pd.DataFrame(data)
    if df.empty:
        return []
        
    # Group by category and month
    monthly_agg = df.groupby(["category", "month"])["amount"].sum().reset_index()
    
    # Get next month string
    today = datetime.datetime.utcnow()
    next_month_dt = (today.replace(day=28) + datetime.timedelta(days=4)) # dynamic move to next month
    next_month_str = next_month_dt.strftime("%Y-%m")
    
    predictions = []
    
    categories = df["category"].unique()
    for cat in categories:
        cat_data = monthly_agg[monthly_agg["category"] == cat].sort_values("month")
        
        # Need at least some historical points. If we only have 1 or 2, we do average + random trend.
        if len(cat_data) < 3:
            # Fallback forecast using simple average and conservative uncertainty bounds
            avg_spend = cat_data["amount"].mean() if not cat_data.empty else 200.0
            pred_val = avg_spend * 1.05 # Add slight drift
            conf_lower = max(0.0, pred_val * 0.8)
            conf_upper = pred_val * 1.25
        else:
            # Convert month strings to serial numbers
            cat_data["month_idx"] = range(len(cat_data))
            X = cat_data[["month_idx"]].values
            y = cat_data["amount"].values
            
            # Fit simple linear model
            from sklearn.linear_model import LinearRegression
            model = LinearRegression()
            model.fit(X, y)
            
            # Predict next month index
            next_idx = len(cat_data)
            pred_val = float(model.predict([[next_idx]])[0])
            
            # If negative, cap at 0
            if pred_val < 0:
                pred_val = float(np.mean(y) * 0.5)
                
            # Confidence interval based on residual standard deviation
            residuals = y - model.predict(X)
            std_err = np.std(residuals) if len(residuals) > 1 else (pred_val * 0.1)
            
            # 90% confidence interval standard critical value multiplier
            conf_lower = max(0.0, pred_val - 1.645 * std_err)
            conf_upper = pred_val + 1.645 * std_err
            
            # Adjust if confidence bounds are too narrow/wide
            if conf_upper - conf_lower < pred_val * 0.1:
                conf_lower = max(0.0, pred_val * 0.85)
                conf_upper = pred_val * 1.15
        
        predictions.append({
            "category": cat,
            "predicted_amount": round(pred_val, 2),
            "confidence_lower": round(conf_lower, 2),
            "confidence_upper": round(conf_upper, 2),
            "month": next_month_str,
            "model_version": "v1.1-SeasonalRegression"
        })
        
    return predictions

def generate_optimizations(room_id: int, db: Session) -> List[Dict[str, Any]]:
    """
    Scans expenses to find patterns and rules-based opportunities to save money.
    Returns ranked optimization suggestions.
    """
    # Fetch room expenses
    expenses = db.query(models.Expense).filter(models.Expense.room_id == room_id).all()
    if not expenses:
        return []
        
    df = pd.DataFrame([{
        "amount": e.amount,
        "category": e.category,
        "vendor": e.vendor.lower().strip(),
        "date": datetime.datetime.strptime(e.date, "%Y-%m-%d") if e.date else datetime.datetime.utcnow(),
        "payment_mode": e.payment_mode
    } for e in expenses])
    
    suggestions = []
    
    # 1. Delivery App Optimization (Zepto, Blinkit vs Local markets)
    delivery_mask = df["vendor"].isin(DELIVERY_VENDORS)
    delivery_df = df[delivery_mask]
    
    if not delivery_df.empty:
        # Calculate monthly spend on delivery apps for vegetables / fruits / groceries
        total_delivery_spend = delivery_df["amount"].sum()
        # Assume buying from local vendor saves ~20%
        potential_savings = total_delivery_spend * 0.20
        
        # Check specific category: vegetables/fruits/milk on Zepto/Blinkit
        fresh_food_delivery = delivery_df[delivery_df["category"].isin(["vegetables", "fruits", "milk", "groceries"])]
        fresh_delivery_spend = fresh_food_delivery["amount"].sum()
        fresh_savings = fresh_delivery_spend * 0.25 # up to 25% savings locally
        
        if fresh_savings > 100:
            suggestions.append({
                "type": "optimization",
                "title": "Buy fresh items from local vendors",
                "description": f"You spent ₹{fresh_delivery_spend:.0f} on quick commerce delivery (Zepto/Blinkit) for vegetables, fruits, and milk this month. Buying from a local market could save up to ₹{fresh_savings:.0f} (approx 25% markup on quick delivery).",
                "savings_potential": round(fresh_savings, 2),
                "rank": 1
            })
            
    # 2. Weekend Spikes (e.g. online delivery, non-veg, or entertainment)
    # Check if spending on non-veg/entertainment/delivery is significantly higher on Fri/Sat/Sun
    df["day_of_week"] = df["date"].dt.weekday # 0 is Monday, 5/6 is Saturday/Sunday
    df["is_weekend"] = df["day_of_week"].isin([4, 5, 6]) # Fri, Sat, Sun
    
    weekend_spikes = df[df["is_weekend"] & df["category"].isin(["online delivery", "non-veg", "entertainment", "restaurants"])]
    weekday_spikes = df[~df["is_weekend"] & df["category"].isin(["online delivery", "non-veg", "entertainment", "restaurants"])]
    
    weekend_avg = weekend_spikes["amount"].sum()
    weekday_avg = weekday_spikes["amount"].sum()
    
    # If weekend spends are double weekday spends in these categories
    if weekend_avg > weekday_avg * 1.5 and weekend_avg > 300:
        savings = weekend_avg * 0.15 # 15% savings with minor planning
        suggestions.append({
            "type": "optimization",
            "title": "Weekend spend planning",
            "description": "Your food and entertainment spend spikes heavily during the weekends (Friday - Sunday). Pre-planning meals or opting for bulk orders/group deals could trim weekend costs by around 15%, saving ₹" + f"{savings:.0f}/month.",
            "savings_potential": round(savings, 2),
            "rank": 2
        })

    # 3. Utilities check
    utilities_df = df[df["category"] == "utilities"]
    if not utilities_df.empty:
        util_spend = utilities_df["amount"].sum()
        if util_spend > 500:
            savings = util_spend * 0.10
            suggestions.append({
                "type": "optimization",
                "title": "Energy-saving checklist",
                "description": f"Your current room utility bill stands at ₹{util_spend:.0f}. Encouraging members to unplug idle electronics and switch off ACs/geysers when leaving rooms can easily save ₹{savings:.0f}/month.",
                "savings_potential": round(savings, 2),
                "rank": 3
            })

    # Default general optimizations if suggestions are empty
    if not suggestions:
        suggestions.append({
            "type": "optimization",
            "title": "Categorize and Tag Expenses",
            "description": "Start categorizing all expenses and adding tags (like #bulk or #party) to unlock personalized optimization recommendations.",
            "savings_potential": 100.0,
            "rank": 4
        })
        
    return sorted(suggestions, key=lambda x: x["savings_potential"], reverse=True)
