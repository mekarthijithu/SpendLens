import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app import models, auth

def clear_and_init_production_database():
    # Drop and recreate all tables for a fresh start
    print("Recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 1. Create the B6 room
    print("Creating room 'B6'...")
    room = models.Room(
        name="B6",
        invite_code="B6ROOM",
        created_by=1
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # 2. Seed production users, all assigned to the B6 room
    print("Seeding production users into room B6...")
    users_data = [
        {"name": "Akhil", "email": "akhil@bachelorhome.com", "upi_id": "akhil@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Akhil"},
        {"name": "Vikas", "email": "vikas@bachelorhome.com", "upi_id": "vikas@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Vikas"},
        {"name": "Jithu", "email": "jithu@bachelorhome.com", "upi_id": "jithu@oksbi", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jithu"},
        {"name": "Bhanu", "email": "bhanu@bachelorhome.com", "upi_id": "bhanu@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Bhanu"},
        {"name": "Jagan", "email": "jagan@bachelorhome.com", "upi_id": "jagan@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jagan"}
    ]
    
    for ud in users_data:
        hashed_password = auth.get_password_hash("password123")
        db_user = models.User(
            name=ud["name"],
            email=ud["email"],
            hashed_password=hashed_password,
            room_id=room.id,  # Pre-assigned to B6 room
            upi_id=ud["upi_id"],
            avatar=ud["avatar"]
        )
        db.add(db_user)
        
    db.commit()
    db.close()
    print("Production initialization completed! Room 'B6' created with all 5 members.")

if __name__ == "__main__":
    clear_and_init_production_database()
