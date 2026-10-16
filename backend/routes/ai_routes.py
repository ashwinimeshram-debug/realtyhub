"""AI-assisted listing copy generation.

Generates a listing title + description from the property form inputs.

The endpoint always works: when no AI provider key is configured it falls back
to a deterministic local composition, so the "Generate with AI" button in the
post form is useful today. Add one of these to the backend env to activate the
real provider:

    AI_PROVIDER=openai     AI_API_KEY=sk-...
    AI_PROVIDER=anthropic  AI_API_KEY=sk-ant-...
    # or the provider-specific names:
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-ant-...
"""
import json
import logging
import os
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import limiter

logger = logging.getLogger("realtyhub.ai")

ai_bp = Blueprint("ai", __name__)

_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_OPENAI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
_ANTHROPIC_MODEL = os.getenv("AI_MODEL", "claude-3-5-haiku-latest")

_TXN_LABELS = {"buy": "Buy", "rent": "Rent", "resale": "Resale", "sell": "Sale"}
_LISTED_BY_LABELS = {"owner": "Owner", "agent": "Agent", "broker": "Broker"}


def _provider_config():
    """Return (provider, api_key) if an AI provider is configured, else (None, None)."""
    provider = (os.getenv("AI_PROVIDER") or "").strip().lower()
    key = (os.getenv("AI_API_KEY") or "").strip()
    if not provider:
        if os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        elif os.getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
    if not key:
        if provider == "anthropic":
            key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        else:
            key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if provider in ("openai", "anthropic") and key:
        return provider, key
    return None, None


def _build_prompt(payload):
    ptype = payload.get("property_type") or "property"
    txn = _TXN_LABELS.get((payload.get("transaction_type") or "sell").lower(), "Sale")
    listed_by = _LISTED_BY_LABELS.get(payload.get("listed_by") or "owner", "Owner")
    location = payload.get("location") or ""
    price = payload.get("price_text") or ""
    features = payload.get("features") or []
    if isinstance(features, str):
        features = [f.strip() for f in features.split(",") if f.strip()]
    if isinstance(features, list):
        features = ", ".join(str(f) for f in features if f)
    notes = payload.get("notes") or ""
    return (
        "You write concise, appealing real-estate listing copy for an Indian property portal.\n"
        "Return ONLY strict JSON with keys \"title\" and \"description\".\n"
        "- title: max 70 characters, no emojis, include the locality and the deal type.\n"
        "- description: 2 short paragraphs, factual and inviting, no emojis, no markdown.\n\n"
        f"Property type: {ptype}\n"
        f"Deal type: {txn}\n"
        f"Listed by: {listed_by}\n"
        f"Location: {location}\n"
        f"Price: {price}\n"
        f"Features: {features}\n"
        f"Extra notes: {notes}\n"
    )


def _call_openai(api_key, prompt):
    body = json.dumps({
        "model": _OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful real-estate copywriter."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")
    req = urllib.request.Request(
        _OPENAI_URL, data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def _call_anthropic(api_key, prompt):
    body = json.dumps({
        "model": _ANTHROPIC_MODEL,
        "max_tokens": 700,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = urllib.request.Request(
        _ANTHROPIC_URL, data=body,
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["content"][0]["text"]


def _parse_model_json(raw):
    """Extract {title, description} from a model response, tolerating code fences."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        obj = json.loads(text[start:end + 1])
    except (ValueError, TypeError):
        return None
    title = (obj.get("title") or "").strip()
    description = (obj.get("description") or "").strip()
    if not title and not description:
        return None
    return {"title": title, "description": description}


def _compose_locally(payload):
    """Deterministic fallback copy — used when no AI provider is configured."""
    ptype = (payload.get("property_type") or "property").replace("-", " ").title()
    txn = _TXN_LABELS.get((payload.get("transaction_type") or "sell").lower(), "Sale")
    listed_by = _LISTED_BY_LABELS.get(payload.get("listed_by") or "owner", "Owner")
    location = (payload.get("location") or "").strip()
    price = (payload.get("price_text") or "").strip()
    features = payload.get("features") or []
    if isinstance(features, str):
        features = [f.strip() for f in features.split(",") if f.strip()]
    features = [str(f).strip() for f in features if str(f).strip()]

    title = ptype
    if txn:
        title += f" for {txn}"
    if location:
        title += f" in {location}"
    if price and price not in ("*", "-"):
        title += f" – {price}"
    title = title[:70]

    parts = [f"{ptype} available for {txn.lower()}"]
    if location:
        parts.append(f"in {location}")
    opening = " ".join(parts) + "."
    if price and price not in ("*", "-"):
        opening += f" Priced at {price}."
    opening += f" Listed by the {listed_by.lower()}."

    if features:
        bullet = "Highlights include " + ", ".join(features[:8]) + "."
    else:
        bullet = "Contact us for full details, photos and a site visit."

    return {"title": title, "description": f"{opening}\n\n{bullet}"}


@ai_bp.route("/ai/generate-listing", methods=["POST"])
@jwt_required()
@limiter.limit("30/hour")
def generate_listing():
    payload = request.get_json(silent=True) or {}
    provider, api_key = _provider_config()

    if provider:
        try:
            raw = _call_openai(api_key, _build_prompt(payload)) if provider == "openai" \
                else _call_anthropic(api_key, _build_prompt(payload))
            parsed = _parse_model_json(raw)
            if parsed:
                return jsonify({
                    "title": parsed["title"],
                    "description": parsed["description"],
                    "ai_enabled": True,
                    "provider": provider,
                })
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, KeyError, TimeoutError) as exc:
            logger.warning("AI generation fell back to local compose: %s", exc)

    return jsonify({**_compose_locally(payload), "ai_enabled": False, "provider": None})
