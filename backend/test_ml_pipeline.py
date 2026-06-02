import os
import sys
from app.database import SessionLocal, engine, Base
from app import models, ml
from seed_data import seed_database

def run_verification():
    print("=== SpendLens ML Pipeline Verification ===")
    
    # 1. Seed database
    print("\n[Step 1] Seeding database with historical records...")
    seed_database()
    
    # 2. Verify Database Connection and Seeding
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        expenses = db.query(models.Expense).all()
        budgets = db.query(models.Budget).all()
        
        print(f"Verified Database contents:")
        print(f" - Users: {len(users)}")
        print(f" - Expenses: {len(expenses)}")
        print(f" - Budgets: {len(budgets)}")
        
        if len(expenses) == 0:
            print("ERROR: No expenses found!")
            sys.exit(1)
            
        # 3. Test Anomaly Detection
        print("\n[Step 2] Testing Isolation Forest Anomaly Detection...")
        # Normal spend
        normal_amount = 350.0
        is_anom, msg = ml.detect_anomaly(normal_amount, "groceries", 1, db)
        print(f" - Normal Groceries spend (INR {normal_amount}): Anomaly={is_anom} (Message: '{msg.replace('₹', 'INR')}')")
        
        # Outlier spend
        outlier_amount = 8500.0
        is_anom, msg = ml.detect_anomaly(outlier_amount, "groceries", 1, db)
        print(f" - Outlier Groceries spend (INR {outlier_amount}): Anomaly={is_anom} (Message: '{msg.replace('₹', 'INR')}')")
        
        # 4. Test Time-series Forecasting
        print("\n[Step 3] Testing Seasonal Trend Forecasting...")
        predictions = ml.generate_predictions(1, db)
        print(f"Generated {len(predictions)} category spend predictions for next month:")
        for p in predictions[:5]:
            print(f" - Category '{p['category']}': Expected spend = INR {p['predicted_amount']} (Range: INR {p['confidence_lower']} - INR {p['confidence_upper']})")
            
        # 5. Test Optimization Engine
        print("\n[Step 4] Testing Optimization Recommendations...")
        recommendations = ml.generate_optimizations(1, db)
        print(f"Generated {len(recommendations)} saving recommendations:")
        for r in recommendations:
            print(f" - '{r['title']}': Savings potential = INR {r['savings_potential']} | Description: {r['description'].replace('₹', 'INR')[:100]}...")
            
        print("\n=== ML Pipeline Verification Successful! ===")
        
    except Exception as e:
        print(f"ERROR running verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
