"""Migrate existing mail settings rows to the hosting SMTP defaults.

The mailer reads SMTP config from the DB ``settings`` table, and the first-boot
seeder only inserts missing keys — so an existing ``mail_enabled=false`` (or the
old Gmail host) row is never updated. This script flips those legacy rows to the
current hosting defaults **only when they still hold the old placeholder values**,
so real credentials an admin already saved are never clobbered.

Usage (run from the ``backend`` directory):

    python scripts/migrate_mail_settings.py            # apply
    python scripts/migrate_mail_settings.py --dry-run  # preview only

Set the mailbox password separately (via the admin panel or --password), since
it is never committed to the repo.
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models.setting_model import Setting  # noqa: E402


# key -> (old placeholder values that may be safely migrated, new default)
MIGRATIONS = {
    "mail_enabled": ({"false", ""}, "true"),
    "mail_server": ({"smtp.gmail.com", ""}, "mail.plotandroof.com"),
    "mail_port": ({"587"}, "465"),
    "mail_use_tls": ({"true"}, "false"),
    "mail_username": ({"info@nagpurrealtyhub.com", ""}, "info@plotandroof.com"),
    "mail_sender": ({"info@nagpurrealtyhub.com", ""}, "info@plotandroof.com"),
}
# keys to create when absent
DEFAULTS = {
    "mail_use_ssl": "true",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate mail settings to hosting SMTP.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--password", default=None, help="Set the mailbox SMTP password.")
    parser.add_argument("--sender", default=None, help="Override the From address.")
    parser.add_argument("--username", default=None, help="Override the SMTP login username.")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        for key, (old_values, new_value) in MIGRATIONS.items():
            row = Setting.query.filter_by(skey=key).first()
            if not row:
                print(f"[create] {key} = {new_value}")
                if not args.dry_run:
                    db.session.add(Setting(skey=key, svalue=new_value))
                continue
            if row.svalue in old_values:
                print(f"[update] {key}: {row.svalue!r} -> {new_value!r}")
                if not args.dry_run:
                    row.svalue = new_value
            else:
                print(f"[keep]   {key} = {row.svalue!r} (not a placeholder)")

        for key, value in DEFAULTS.items():
            row = Setting.query.filter_by(skey=key).first()
            if not row:
                print(f"[create] {key} = {value}")
                if not args.dry_run:
                    db.session.add(Setting(skey=key, svalue=value))
            else:
                print(f"[keep]   {key} = {row.svalue!r}")

        for key, value in (("mail_username", args.username),
                           ("mail_sender", args.sender),
                           ("mail_password", args.password)):
            if not value:
                continue
            row = Setting.query.filter_by(skey=key).first()
            if row:
                print(f"[override] {key}")
                if not args.dry_run:
                    row.svalue = value
            else:
                print(f"[create] {key}")
                if not args.dry_run:
                    db.session.add(Setting(skey=key, svalue=value))

        if not args.dry_run:
            db.session.commit()
            print("Committed.")
        else:
            print("Dry run — nothing committed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
