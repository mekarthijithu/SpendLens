import datetime
import random
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from . import models, auth

def seed_database_if_empty(db: Session):
    # Check if we already have users
    try:
        user_count = db.query(models.User).count()
        if user_count > 0:
            print("Database already contains users. Skipping automatic seeding.")
            return
    except Exception as e:
        print(f"Error checking user count: {e}. Attempting to run anyway...")

    print("Database is empty. Starting automatic database seeding...")
    
    # 1. Create Room
    room = models.Room(
        name="B6",
        invite_code="LENS99",
        created_by=1
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # 2. Create Users
    users_data = [
        {"name": "Akhil", "email": "akhil@spendlens.com", "upi_id": "akhil@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Akhil"},
        {"name": "Vikas", "email": "vikas@spendlens.com", "upi_id": "vikas@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Vikas"},
        {"name": "Jithu", "email": "jithu@spendlens.com", "upi_id": "jithu@oksbi", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jithu"},
        {"name": "Bhanu", "email": "bhanu@spendlens.com", "upi_id": "bhanu@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Bhanu"},
        {"name": "Jagan", "email": "jagan@spendlens.com", "upi_id": "jagan@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jagan"}
    ]
    
    users = []
    for u_idx, ud in enumerate(users_data):
        hashed_password = auth.get_password_hash("password123")
        db_user = models.User(
            name=ud["name"],
            email=ud["email"],
            hashed_password=hashed_password,
            room_id=room.id,
            upi_id=ud["upi_id"],
            avatar=ud["avatar"]
        )
        db.add(db_user)
        users.append(db_user)
        
    db.commit()
    # Refresh to get IDs
    for u in users:
        db.refresh(u)
        
    # Update room creator ID
    room.created_by = users[0].id
    db.commit()
    
    # 3. Create Monthly Budgets for the current month
    today = datetime.datetime.utcnow()
    current_month_str = today.strftime("%Y-%m")
    
    budgets = [
        {"category": "vegetables", "limit": 1500.0},
        {"category": "non-veg", "limit": 3000.0},
        {"category": "groceries", "limit": 6000.0},
        {"category": "online delivery", "limit": 3000.0},
        {"category": "rent", "limit": 20000.0},
        {"category": "household supplies", "limit": 1500.0}
    ]
    
    for b in budgets:
        db_budget = models.Budget(
            room_id=room.id,
            category=b["category"],
            monthly_limit=b["limit"],
            month=current_month_str
        )
        db.add(db_budget)
    db.commit()
    
    # 4. Create Historical Expenses for the last 5 months + current month
    categories = [b["category"] for b in budgets]
    
    # Base vendors
    vendors_by_cat = {
        "vegetables": ["Local Mandi", "Zepto", "Blinkit", "Reliance Fresh"],
        "non-veg": ["Licious", "Meat Shop", "FreshToHome", "Local Fish Market"],
        "groceries": ["D-Mart", "Supermarket", "BigBasket", "Kirana Shop"],
        "online delivery": ["Zomato", "Swiggy", "Zepto", "Blinkit", "Eatsure"],
        "rent": ["House Owner Trust"],
        "household supplies": ["Amazon", "D-Mart", "Blinkit"]
    }
    
    modes = ["UPI", "Card", "Cash"]
    
    expense_count = 0
    
    for month_offset in range(5, -1, -1):
        temp_date = today - datetime.timedelta(days=month_offset * 30.5)
        month_str = temp_date.strftime("%Y-%m")
        days_in_month = 28
        
        db.add(models.Expense(
            user_id=users[1 if month_offset % 2 == 0 else 2].id,
            room_id=room.id,
            amount=20000.0,
            category="rent",
            vendor="Landlord",
            payment_mode="Bank Transfer",
            date=f"{month_str}-01",
            is_shared=True,
            tags=["rent", "fixed-cost"],
            notes=f"Monthly house rent for {month_str}"
        ))
        expense_count += 1
        
        for category in categories:
            if category in ["rent"]:
                continue
                
            if category in ["vegetables"]:
                frequencies = 6
                base_amount_range = (80, 200)
            elif category in ["online delivery"]:
                frequencies = 4
                base_amount_range = (250, 750)
            elif category == "groceries":
                frequencies = 2
                base_amount_range = (1200, 2800)
            else:
                frequencies = random.randint(1, 3)
                base_amount_range = (150, 1000)
                
            for _ in range(frequencies):
                day = random.randint(1, days_in_month)
                date_str = f"{month_str}-{day:02d}"
                
                month_factor = 1.0 + (5 - month_offset) * 0.05
                amount = round(random.uniform(*base_amount_range) * month_factor, 2)
                
                vendor = random.choice(vendors_by_cat[category])
                payment_mode = random.choice(modes)
                user = random.choice(users)
                is_shared = random.random() < 0.85
                tags = [category]
                if "zepto" in vendor.lower() or "blinkit" in vendor.lower():
                    tags.append("delivery")
                if amount > 1000:
                    tags.append("bulk")
                    
                db.add(models.Expense(
                    user_id=user.id,
                    room_id=room.id,
                    amount=amount,
                    category=category,
                    vendor=vendor,
                    payment_mode=payment_mode,
                    date=date_str,
                    is_shared=is_shared,
                    tags=tags,
                    notes=f"Log item for {category} at {vendor}"
                ))
                expense_count += 1
                
    db.add(models.Expense(
        user_id=users[2].id,
        room_id=room.id,
        amount=5500.0,
        category="non-veg",
        vendor="Premium Seafood Mandi",
        payment_mode="Card",
        date=f"{current_month_str}-15",
        is_shared=True,
        tags=["party", "seafood", "anomaly"],
        notes="Spontaneous crab and lobster dinner party for the entire house!"
    ))
    expense_count += 1
    
    db.add(models.Expense(
        user_id=users[1].id,
        room_id=room.id,
        amount=4200.0,
        category="online delivery",
        vendor="Swiggy Gourmet",
        payment_mode="UPI",
        date=f"{current_month_str}-20",
        is_shared=True,
        tags=["weekend-party"],
        notes="Birthday treat ordering from premium restaurant"
    ))
    expense_count += 1
    
    db.commit()
    
    # 5. Seed some Notifications
    notifications = [
        {
            "user_id": users[0].id,
            "type": "room",
            "message": "Welcome to SpendLens! You created the room 'B6'. Share your invite code LENS99 to invite housemates.",
            "read": True
        },
        {
            "user_id": users[0].id,
            "type": "room",
            "message": "Vikas has joined your SpendLens room!",
            "read": True
        },
        {
            "user_id": users[0].id,
            "type": "budget",
            "message": f"You have spent 80% of your 'online delivery' budget (₹2,450 of ₹3,000) this month.",
            "read": False
        },
        {
            "user_id": users[0].id,
            "type": "anomaly",
            "message": f"Anomaly Alert: Spend of ₹5,500 on 'non-veg' by Jithu is significantly higher than your typical average of ₹550 (+900% spike).",
            "read": False
        }
    ]
    
    for n in notifications:
        db.add(models.Notification(
            user_id=n["user_id"],
            type=n["type"],
            message=n["message"],
            read=n["read"]
        ))
        
    db.commit()
    print("Database seeded successfully with initial data.")
