"""AI-assisted listing copy generation.

Generates a listing title + description from the property form inputs.

The endpoint always works: when no AI provider key is configured it falls back
to a deterministic local composition, so the "Generate with AI" button in the
post form is useful today.

Configure the provider from the admin UI (Settings -> AI Configuration), or via
one of these environment variables:

    AI_PROVIDER=openai     AI_API_KEY=sk-...
    AI_PROVIDER=anthropic  AI_API_KEY=sk-ant-...
    AI_PROVIDER=gemini     AI_API_KEY=AIza...
    # or the provider-specific names:
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-ant-...
    GEMINI_API_KEY=AIza...
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
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_OPENAI_MODELS_URL = "https://api.openai.com/v1/models"
_ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models"

_PROVIDER_ALIASES = {
    "openai": "openai", "chatgpt": "openai", "gpt": "openai",
    "anthropic": "anthropic", "claude": "anthropic",
    "gemini": "gemini", "google": "gemini", "google-gemini": "gemini",
}
_SUPPORTED_PROVIDERS = ("openai", "anthropic", "gemini")
_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "gemini": "gemini-2.5-flash",
}
_GEMINI_KEY_ENVS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY")

_TXN_LABELS = {"buy": "Buy", "rent": "Rent", "resale": "Resale", "sell": "Sale"}
_LISTED_BY_LABELS = {"owner": "Owner", "agent": "Agent", "broker": "Broker"}


def _db_setting(key, default=None):
    """Read an admin-configured setting from the DB, ignoring blank values."""
    try:
        from routes.settings_routes import get_all_settings
        val = get_all_settings().get(key)
    except Exception:
        val = None
    if val is None or str(val).strip() == "":
        return default
    return str(val).strip()


def _normalize_provider(provider):
    return _PROVIDER_ALIASES.get((provider or "").strip().lower(), (provider or "").strip().lower())


def _env_gemini_key():
    for name in _GEMINI_KEY_ENVS:
        val = os.getenv(name)
        if val and val.strip():
            return val.strip()
    return ""


def _ai_enabled():
    """AI is on unless an admin explicitly disabled it (env-only setups stay on)."""
    val = _db_setting("ai_enabled")
    if val is None:
        return True
    return val.lower() not in ("false", "0", "no", "off")


def _provider_key(provider):
    """Resolve the API key for a specific provider (saved setting first, then env)."""
    provider = _normalize_provider(provider)
    key = (_db_setting("ai_api_key") or os.getenv("AI_API_KEY") or "").strip()
    if key:
        return key
    if provider == "openai":
        return (os.getenv("OPENAI_API_KEY") or "").strip()
    if provider == "anthropic":
        return (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if provider == "gemini":
        return _env_gemini_key()
    return ""


def _provider_config():
    """Return (provider, api_key) from admin settings (env fallback), else (None, None)."""
    if not _ai_enabled():
        return None, None
    provider = _normalize_provider(_db_setting("ai_provider") or os.getenv("AI_PROVIDER"))
    key = (_db_setting("ai_api_key") or os.getenv("AI_API_KEY") or "").strip()
    if not provider:
        if key.startswith("AIza"):
            provider = "gemini"
        elif key.startswith("sk-ant"):
            provider = "anthropic"
        elif key.startswith("sk-"):
            provider = "openai"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        elif os.getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif _env_gemini_key():
            provider = "gemini"
    if not key:
        key = _provider_key(provider)
    if provider in _SUPPORTED_PROVIDERS and key:
        return provider, key
    return None, None


def _model_for(provider):
    """Resolve the model to use, preferring the admin setting over the env default."""
    return _db_setting("ai_model") or os.getenv("AI_MODEL") or _DEFAULT_MODELS.get(provider, "")


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


def _call_openai(api_key, prompt, model):
    body = json.dumps({
        "model": model,
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


def _call_anthropic(api_key, prompt, model):
    body = json.dumps({
        "model": model,
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


def _call_gemini(api_key, prompt, model):
    model = (model or "").split("/")[-1]
    url = f"{_GEMINI_URL}/{model}:generateContent"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"},
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_provider(provider, api_key, prompt, model):
    """Dispatch a text-generation request to the configured provider."""
    if provider == "openai":
        return _call_openai(api_key, prompt, model)
    if provider == "anthropic":
        return _call_anthropic(api_key, prompt, model)
    if provider == "gemini":
        return _call_gemini(api_key, prompt, model)
    raise ValueError(f"Unsupported provider: {provider}")


_OPENAI_NON_CHAT = ("image", "audio", "realtime", "transcribe", "tts", "whisper",
                    "embedding", "moderation", "dall-e", "search", "sora")


def _is_openai_chat_model(model_id):
    if not model_id:
        return False
    if not model_id.startswith(("gpt-", "chatgpt", "o1", "o3", "o4", "o5")):
        return False
    return not any(bad in model_id for bad in _OPENAI_NON_CHAT)


def _list_openai_models(api_key):
    req = urllib.request.Request(
        _OPENAI_MODELS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    ids = {m.get("id", "") for m in data.get("data", [])}
    return [{"id": i, "label": i} for i in sorted(ids) if _is_openai_chat_model(i)]


def _list_anthropic_models(api_key):
    req = urllib.request.Request(
        _ANTHROPIC_MODELS_URL,
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for m in data.get("data", []):
        mid = m.get("id", "")
        if mid:
            out.append({"id": mid, "label": m.get("display_name") or mid})
    return out


def _list_gemini_models(api_key):
    req = urllib.request.Request(_GEMINI_URL, headers={"x-goog-api-key": api_key})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for m in data.get("models", []):
        methods = m.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        mid = (m.get("name", "") or "").split("/")[-1]
        if mid:
            out.append({"id": mid, "label": m.get("displayName") or mid})
    return out


def _list_provider_models(provider, api_key):
    provider = _normalize_provider(provider)
    if provider == "openai":
        return _list_openai_models(api_key)
    if provider == "anthropic":
        return _list_anthropic_models(api_key)
    if provider == "gemini":
        return _list_gemini_models(api_key)
    raise ValueError(f"Unsupported provider: {provider}")


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
        model = _model_for(provider)
        try:
            raw = _call_provider(provider, api_key, _build_prompt(payload), model)
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


@ai_bp.route("/ai/test", methods=["POST"])
@jwt_required()
@limiter.limit("30/hour")
def test_ai():
    """Verify the configured AI provider/key by issuing a tiny request."""
    provider, api_key = _provider_config()
    if not provider:
        return jsonify({"ok": False, "error": "No AI provider configured. Add an API key and enable AI."})
    model = _model_for(provider)
    prompt = 'Return ONLY JSON: {"title":"OK","description":"Connection successful."}'
    try:
        raw = _call_provider(provider, api_key, prompt, model)
        return jsonify({"ok": True, "provider": provider, "model": model, "sample": (raw or "")[:200]})
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")[:300]
        except Exception:
            detail = ""
        return jsonify({"ok": False, "provider": provider, "model": model,
                        "error": f"Provider returned HTTP {exc.code}. {detail}".strip()})
    except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
        return jsonify({"ok": False, "provider": provider, "model": model, "error": str(exc)})


@ai_bp.route("/ai/models", methods=["POST"])
@jwt_required()
@limiter.limit("60/hour")
def list_ai_models():
    """List the models available for a provider so an admin can pick one.

    Uses the API key from the request body when supplied (so a key can be
    validated before saving), falling back to the saved/env key.
    """
    payload = request.get_json(silent=True) or {}
    provider = _normalize_provider(payload.get("provider"))
    if provider not in _SUPPORTED_PROVIDERS:
        return jsonify({"error": "Choose a provider first."}), 400
    api_key = (payload.get("api_key") or "").strip() or _provider_key(provider)
    if not api_key:
        return jsonify({"error": "Enter an API key (and save) to load the model list."}), 400
    try:
        models = _list_provider_models(provider, api_key)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")[:300]
        except Exception:
            detail = ""
        return jsonify({"error": f"Provider returned HTTP {exc.code}. {detail}".strip()})
    except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
        return jsonify({"error": str(exc)})
    return jsonify({"provider": provider, "models": models, "default": _DEFAULT_MODELS.get(provider, "")})
