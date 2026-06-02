from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    avatar: Optional[str] = None
    upi_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    upi_id: Optional[str] = None

class UserResponse(UserBase):
    id: int
    room_id: Optional[int] = None

    class Config:
        from_attributes = True

# Room Schemas
class RoomBase(BaseModel):
    name: str

class RoomCreate(RoomBase):
    pass

class RoomResponse(RoomBase):
    id: int
    invite_code: str
    created_by: Optional[int] = None

    class Config:
        from_attributes = True

class RoomDetailResponse(RoomResponse):
    members: List[UserResponse] = []

    class Config:
        from_attributes = True

class JoinRoomRequest(BaseModel):
    invite_code: str

# Expense Schemas
class ExpenseBase(BaseModel):
    amount: float
    category: str
    vendor: str
    payment_mode: str
    date: str  # YYYY-MM-DD
    is_shared: bool = True
    tags: List[str] = []
    notes: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    vendor: Optional[str] = None
    payment_mode: Optional[str] = None
    date: Optional[str] = None
    is_shared: Optional[bool] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

class ExpenseResponse(ExpenseBase):
    id: int
    user_id: int
    room_id: int
    receipt_url: Optional[str] = None
    created_at: datetime
    user_name: Optional[str] = None # Added for UI display

    class Config:
        from_attributes = True

# Budget Schemas
class BudgetBase(BaseModel):
    category: str
    monthly_limit: float
    month: str  # YYYY-MM

class BudgetCreate(BudgetBase):
    pass

class BudgetResponse(BudgetBase):
    id: int
    room_id: int

    class Config:
        from_attributes = True

# Prediction Schemas
class PredictionResponse(BaseModel):
    id: int
    room_id: int
    category: str
    predicted_amount: float
    confidence_lower: float
    confidence_upper: float
    month: str
    model_version: str
    generated_at: datetime

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    message: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# OCR OCR Parse Schemas
class OCRResponse(BaseModel):
    amount: Optional[float] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    payment_mode: Optional[str] = None
    confidence: float
