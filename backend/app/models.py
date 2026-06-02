import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, index=True, nullable=False)
    created_by = Column(Integer, nullable=True) # User ID who created it

    # Relationships
    members = relationship("User", back_populates="room")
    expenses = relationship("Expense", back_populates="room", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="room", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="room", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    avatar = Column(String, nullable=True) # URL or path to avatar
    upi_id = Column(String, nullable=True) # For settlements

    # Relationships
    room = relationship("Room", back_populates="members")
    expenses = relationship("Expense", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False) # e.g. milk, vegetables, groceries...
    vendor = Column(String, nullable=False) # e.g. Zepto, Blinkit, Local Vendor...
    payment_mode = Column(String, nullable=False) # cash, UPI, card
    date = Column(String, nullable=False) # Format: YYYY-MM-DD
    receipt_url = Column(String, nullable=True)
    is_shared = Column(Boolean, default=True)
    tags = Column(JSON, default=[]) # List of string tags
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="expenses")
    room = relationship("Room", back_populates="expenses")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    category = Column(String, nullable=False)
    monthly_limit = Column(Float, nullable=False)
    month = Column(String, nullable=False) # Format: YYYY-MM

    # Relationships
    room = relationship("Room", back_populates="budgets")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    category = Column(String, nullable=False)
    predicted_amount = Column(Float, nullable=False)
    confidence_lower = Column(Float, nullable=False)
    confidence_upper = Column(Float, nullable=False)
    month = Column(String, nullable=False) # Format: YYYY-MM
    model_version = Column(String, default="v1.0")
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    room = relationship("Room", back_populates="predictions")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False) # e.g. budget, prediction, anomaly, optimization, fairness
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")
