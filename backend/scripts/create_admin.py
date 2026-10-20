"""Create (or update) an admin/employee account from the command line.

Usage (run from the ``backend`` directory):

    python scripts/create_admin.py --username admin --email admin@example.com \\
        --password 'S3cure!Pass' --role admin

    # or non-interactively in one shot
    python scripts/create_admin.py --username agent1 --email a@example.com \\
        --password 'S3cure!Pass' --role agent --name 'Agent One'

    # update an existing account's password
    python scripts/create_admin.py --username admin --password 'NewPass'

The default ``admin/admin123`` auto-seed was removed for security, so this is
the supported way to bootstrap the first account on a fresh installation.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

import bcrypt

# Make the backend importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models.models import Admin  # noqa: E402
from utils.permissions import ROLE_MATRIX  # noqa: E402


VALID_ROLES = set(ROLE_MATRIX.keys())


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or update an admin account.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", default=None)
    parser.add_argument("--name", default="Administrator")
    parser.add_argument("--role", default="admin", choices=sorted(VALID_ROLES))
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if not password or len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1

    app = create_app()
    with app.app_context():
        admin = Admin.query.filter(
            (Admin.username == args.username) | (Admin.email == args.email)
        ).first()
        if admin:
            admin.username = args.username
            admin.email = args.email
            admin.name = args.name
            admin.role = args.role
            admin.password = _hash(password)
            admin.is_active = True
            action = "updated"
        else:
            admin = Admin(
                username=args.username,
                email=args.email,
                name=args.name,
                role=args.role,
                password=_hash(password),
                is_active=True,
            )
            db.session.add(admin)
            action = "created"
        db.session.commit()
        print(f"{action} admin id={admin.id} username={admin.username} role={admin.role}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
