"""Seed demo staff (Admin) accounts and demo registered users (Owner).

Every seeded account uses the password ``password`` — this is DEMO DATA and
must never be run against production.

Usage (run from the ``backend`` directory):

    python scripts/seed_demo_users.py

Idempotent: re-running updates existing rows in place.
"""
from __future__ import annotations

import os
import sys

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models.models import Admin, Owner, Role  # noqa: E402
from utils.permissions import ROLE_MATRIX, seed_rbac  # noqa: E402

PASSWORD = "password"

# username, email, name, role slug
DEMO_ADMINS = [
    ("admin", "admin@realtyhub.local", "Admin User", "admin"),
    ("agent1", "agent1@realtyhub.local", "Agent One", "agent"),
    ("tele1", "tele1@realtyhub.local", "Telecaller One", "telecaller"),
    ("builder1", "builder1@realtyhub.local", "Builder One", "builder"),
    ("broker1", "broker1@realtyhub.local", "Broker One", "broker"),
    ("deo1", "deo1@realtyhub.local", "Data Entry One", "deo"),
    ("backoffice1", "backoffice1@realtyhub.local", "Back Office One", "back_office"),
]

# name, email, mobile
DEMO_OWNERS = [
    ("Ravi Sharma", "owner1@realtyhub.local", "9876543210"),
    ("Priya Deshmukh", "owner2@realtyhub.local", "9876500011"),
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main() -> int:
    app = create_app()
    with app.app_context():
        # Ensure roles/permissions exist and every role slug is resolvable.
        seed_rbac()
        role_map = {r.slug: r for r in Role.query.all()}
        pw_hash = _hash(PASSWORD)

        print("== staff (Admin) accounts ==")
        for username, email, name, role_slug in DEMO_ADMINS:
            role = role_map.get(role_slug)
            admin = Admin.query.filter(
                (Admin.username == username) | (Admin.email == email)
            ).first()
            if admin:
                admin.username = username
                admin.email = email
                admin.name = name
                admin.role = role_slug
                admin.role_id = role.id if role else admin.role_id
                admin.password = pw_hash
                admin.is_active = True
                action = "updated"
            else:
                admin = Admin(
                    username=username, email=email, name=name, role=role_slug,
                    role_id=role.id if role else None, password=pw_hash, is_active=True,
                )
                db.session.add(admin)
                action = "created"
            db.session.flush()
            print(f"  {action:7} {username:12} -> {email:28} role={role_slug}")

        print("== registered users (Owner) accounts ==")
        for name, email, mobile in DEMO_OWNERS:
            owner = Owner.query.filter_by(email=email).first()
            if owner:
                owner.name = name
                owner.mobile = mobile
                owner.password = pw_hash
                owner.is_active = True
                owner.is_verified = True
                action = "updated"
            else:
                owner = Owner(
                    name=name, email=email, mobile=mobile, password=pw_hash,
                    is_active=True, is_verified=True,
                )
                db.session.add(owner)
                action = "created"
            db.session.flush()
            print(f"  {action:7} {email:28} verified=True")

        db.session.commit()
        print(f"\nAll demo accounts use the password: {PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
