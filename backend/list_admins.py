# backend/list_admins.py
from app.db import SessionLocal
from app import models

db = SessionLocal()

admins = db.query(models.User).filter(models.User.is_admin == True).all()
for u in admins:
    print(f"{u.id}: {u.name} <{u.email}> admin={u.is_admin}")

db.close()
