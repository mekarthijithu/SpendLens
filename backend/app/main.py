from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, expenses, budgets, analytics, notifications

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SpendLens API",
    description="Financial intelligence and collaborative expense tracking for rooms/households.",
    version="1.1.0"
)

# CORS configuration to allow local frontend access
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000"
]

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
            "/api/expenses/", "/api/budgets/", "/api/analytics/summary", "/api/notifications/"
        ]
    }
