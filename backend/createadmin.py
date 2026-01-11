# backend/create_admin_user.py

from app.db import SessionLocal
from app import models
from app.auth import get_password_hash  # uses the same CryptContext as your app

# >>>>> EDIT THESE TO WHAT YOU WANT <<<<<
ADMIN_NAME = "Devin Chin"
ADMIN_EMAIL = "devinschin@gmail.com"
ADMIN_PASSWORD = "ConcerFater11!"  # the password you'll log in with
# >>>>> <<<<<

db = SessionLocal()

def main():
    user = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()

    if user:
        print(f"Found existing user with email {ADMIN_EMAIL}, updating it to admin.")
        user.name = ADMIN_NAME
        user.hashed_password = get_password_hash(ADMIN_PASSWORD)
        user.is_admin = True
        user.is_active = True
        user.is_blacklisted = False
        # if your model has this field:
        if hasattr(user, "is_verified"):
            user.is_verified = True
    else:
        print(f"No user with email {ADMIN_EMAIL}, creating a new admin.")
        user = models.User(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            hashed_password = get_password_hash(ADMIN_PASSWORD),
            is_admin = True,
            is_active = True,
            is_blacklisted = False,
        )
        # set is_verified if it exists on your model
        if hasattr(user, "is_verified"):
            setattr(user, "is_verified", True)

        db.add(user)

    db.commit()
    print("Admin user ready.")
    print(f"Email: {ADMIN_EMAIL}")
    print(f"Password: {ADMIN_PASSWORD}")

if __name__ == "__main__":
    main()
    db.close()
