"""Passenger WSGI entrypoint (cPanel "Setup Python App").

Passenger expects a module-level ``application`` callable. ``backend/wsgi.py``
only exposes ``app``/``create_app`` and is not used by Passenger.
"""
from app import create_app

application = create_app()
