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
    
    print("Database seeded with clean room and users. No test expenses added.")
