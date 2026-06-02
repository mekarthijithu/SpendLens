from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import random
import string
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def generate_invite_code(db: Session) -> str:
    """Generates a unique 6-character alphanumeric room invite code."""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        # Verify uniqueness
        exists = db.query(models.Room).filter(models.Room.invite_code == code).first()
        if not exists:
            return code

@router.post("/register", response_model=schemas.UserResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if email is already taken
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_pwd = auth.get_password_hash(user_data.password)
    db_user = models.User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hashed_pwd,
        avatar=user_data.avatar or f"https://api.dicebear.com/7.x/adventurer/svg?seed={user_data.name.replace(' ', '')}",
        upi_id=user_data.upi_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Auto-assign user to the B6 room if they don't have one
    if not user.room_id:
        b6_room = db.query(models.Room).filter(models.Room.name == "B6").first()
        if not b6_room:
            # Create the B6 room if it doesn't exist yet
            invite = generate_invite_code(db)
            b6_room = models.Room(name="B6", invite_code=invite, created_by=user.id)
            db.add(b6_room)
            db.commit()
            db.refresh(b6_room)
        user.room_id = b6_room.id
        db.commit()
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/create-room", response_model=schemas.RoomResponse)
def create_room(room_data: schemas.RoomCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    invite = generate_invite_code(db)
    db_room = models.Room(
        name=room_data.name,
        invite_code=invite,
        created_by=current_user.id
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    # Associate user with room
    current_user.room_id = db_room.id
    db.commit()
    db.refresh(current_user)
    
    return db_room

@router.post("/join-room", response_model=schemas.RoomResponse)
def join_room(request: schemas.JoinRoomRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = db.query(models.Room).filter(models.Room.invite_code == request.invite_code.upper().strip()).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid room invite code"
        )
    
    current_user.room_id = room.id
    db.commit()
    db.refresh(current_user)
    
    # Create notification for room members
    for member in room.members:
        if member.id != current_user.id:
            notif = models.Notification(
                user_id=member.id,
                type="room",
                message=f"{current_user.name} has joined your SpendLens room!"
            )
            db.add(notif)
    db.commit()
    
    return room

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.get("/room", response_model=Optional[schemas.RoomDetailResponse])
def get_my_room(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not current_user.room_id:
        return None
    
    room = db.query(models.Room).filter(models.Room.id == current_user.room_id).first()
    return room
