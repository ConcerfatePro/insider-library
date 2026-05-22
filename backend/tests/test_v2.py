import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["ENV"] = "development"
os.environ["SECRET_KEY"] = "test-secret-key"

from app.db import Base, get_db
from app.main import app
from app import models
from app.auth import get_password_hash


@pytest.fixture()
def client(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
    (tmp_path / "uploads").mkdir()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        c._session_factory = TestingSession
        yield c
    app.dependency_overrides.clear()


def _token(client, email="user@test.com", password="password123"):
    db = client._session_factory()
    u = db.query(models.User).filter(models.User.email == email).first()
    if not u:
        u = models.User(
            name="User",
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True,
        )
        db.add(u)
        db.commit()
    db.close()
    res = client.post("/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_listing_create_requires_auth(client):
    res = client.post(
        "/listings/",
        json={
            "title": "Test Pack",
            "short_description": "Short desc",
            "category": "Other",
        },
    )
    assert res.status_code == 401


def test_admin_routes_blocked_for_regular_user(client):
    token = _token(client)
    res = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_verified_review_requires_access(client):
    db = client._session_factory()
    owner = models.User(
        name="Owner",
        email="owner@test.com",
        hashed_password=get_password_hash("password123"),
        is_active=True,
    )
    db.add(owner)
    db.commit()
    listing = models.Listing(
        title="Pack",
        description="Desc",
        short_description="Desc",
        category="Other",
        owner_id=owner.id,
        status="published",
        file_path="x.pdf",
        owner_confirmed=True,
        slug="pack-test",
    )
    db.add(listing)
    db.commit()
    listing_id = listing.id
    db.close()

    token = _token(client, "reviewer@test.com")
    res = client.post(
        f"/reviews/{listing_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "text": "Nice"},
    )
    assert res.status_code == 403


def test_owner_cannot_review_own_listing(client):
    db = client._session_factory()
    owner = models.User(
        name="Owner",
        email="owner2@test.com",
        hashed_password=get_password_hash("password123"),
        is_active=True,
    )
    db.add(owner)
    db.commit()
    listing = models.Listing(
        title="Pack",
        description="Desc",
        short_description="Desc",
        category="Other",
        owner_id=owner.id,
        status="published",
        file_path="x.pdf",
        owner_confirmed=True,
        slug="pack-owner",
    )
    db.add(listing)
    db.commit()
    lid = listing.id
    db.add(models.Download(user_id=owner.id, listing_id=lid))
    db.commit()
    db.close()

    token = _token(client, "owner2@test.com")
    res = client.post(
        f"/reviews/{lid}",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "text": "Self"},
    )
    assert res.status_code == 400
