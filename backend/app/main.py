import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, expenses, budgets, analytics, notifications

# Initialize tables
Base.metadata.create_all(bind=engine)

# Auto-seed database if empty on startup
from .database import SessionLocal
from .seed import seed_database_if_empty
db = SessionLocal()
try:
    seed_database_if_empty(db)
finally:
    db.close()

app = FastAPI(
    title="SpendLens API",
    description="Financial intelligence and collaborative expense tracking for rooms/households.",
    version="1.1.0"
)

# CORS configuration to allow frontend access
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000"
]

# Allow adding production frontend URLs via environment variable
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.extend([url.strip() for url in frontend_url.split(",") if url.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(budgets.router)
app.include_router(analytics.router)
app.include_router(notifications.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "SpendLens Backend API",
        "version": "1.1.0",
        "endpoints": [
            "/api/auth/register", "/api/auth/login", "/api/auth/create-room", "/api/auth/join-room",
            "/api/expenses/", "/api/budgets/", "/api/analytics/summary", "/api/notifications/",
            "/api/admin/clear-db"
        ]
    }

@app.get("/api/admin/clear-db")
def clear_db_route():
    from .database import engine, Base, SessionLocal
    from . import models, auth
    
    db = SessionLocal()
    try:
        print("Resetting database via admin endpoint...")
        # Drop and recreate all tables
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        # Re-create room
        room = models.Room(
            name="B6",
            invite_code="LENS99",
            created_by=1
        )
        db.add(room)
        db.commit()
        db.refresh(room)
        
        # Re-create users
        users_data = [
            {"name": "Akhil", "email": "akhil@spendlens.com", "upi_id": "akhil@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Akhil"},
            {"name": "Vikas", "email": "vikas@spendlens.com", "upi_id": "vikas@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Vikas"},
            {"name": "Jithu", "email": "jithu@spendlens.com", "upi_id": "jithu@oksbi", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jithu"},
            {"name": "Bhanu", "email": "bhanu@spendlens.com", "upi_id": "bhanu@okaxis", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Bhanu"},
            {"name": "Jagan", "email": "jagan@spendlens.com", "upi_id": "jagan@okicici", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=Jagan"}
        ]
        
        for ud in users_data:
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
        db.commit()
        return {"status": "success", "message": "Database reset completed. 5 clean user profiles created."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
