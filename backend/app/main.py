import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .routers import auth, expenses, budgets, analytics, notifications

# Mount static files for receipt uploads
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_dir = os.path.join(base_dir, "uploads")
os.makedirs(uploads_dir, exist_ok=True)


# Initialize tables
Base.metadata.create_all(bind=engine)

# Run a dynamic schema patch to add delivery_type to expenses table if not exists
from sqlalchemy import text
db_conn = engine.connect()
try:
    db_conn.execute(text("ALTER TABLE expenses ADD COLUMN delivery_type VARCHAR DEFAULT 'offline'"))
    db_conn.commit()
    print("Database migration: Added delivery_type column to expenses table.")
except Exception as e:
    # Column probably already exists or table doesn't exist yet
    pass
finally:
    db_conn.close()

# Auto-seed database if empty on startup
from .database import SessionLocal
from .seed import seed_database_if_empty
db = SessionLocal()
try:
    seed_database_if_empty(db)
finally:
    db.close()

app = FastAPI(
    title="Bachelor Home API",
    description="Financial intelligence and collaborative expense tracking for rooms/households.",
    version="1.1.0"
)

app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


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
        "app": "Bachelor Home Backend API",
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
