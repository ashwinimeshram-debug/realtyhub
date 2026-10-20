"""Facebook (Meta) Graph API helpers for Facebook Lead Ads.

Uses only ``urllib`` (the project avoids the ``requests`` dependency). All calls
take an explicit Page Access Token; token storage/encryption lives in the model
layer. Network errors are raised as ``MetaError`` so callers can surface a clean
message to the admin UI.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("realtyhub.meta")

GRAPH_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"


class MetaError(Exception):
    """A Graph API call failed (network, auth, or a non-2xx API response)."""


def _request(url, params=None, method="GET"):
    if params:
        query = urllib.parse.urlencode(params)
        if method == "GET":
            url = f"{url}?{query}"
        else:
            url = f"{url}?{query}"
    req = urllib.request.Request(url, method=method, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")[:400]
        except Exception:
            pass
        raise MetaError(f"Graph API returned HTTP {exc.code}. {detail}".strip())
    except urllib.error.URLError as exc:
        raise MetaError(f"Could not reach the Graph API: {exc.reason}")
    except TimeoutError:
        raise MetaError("The Graph API request timed out.")
    try:
        data = json.loads(body)
    except (ValueError, TypeError):
        raise MetaError("The Graph API returned an unreadable response.")
    if isinstance(data, dict) and data.get("error"):
        err = data["error"] or {}
        msg = err.get("message") or "Graph API error"
        raise MetaError(f"{msg} (code {err.get('code')})")
    return data


def get_page(page_id, access_token):
    """Validate a page id/token pair and return {id, name}."""
    data = _request(f"{GRAPH_BASE}/{page_id}", {"access_token": access_token, "fields": "id,name"})
    return {"id": str(data.get("id") or page_id), "name": data.get("name") or ""}


def get_lead(leadgen_id, access_token):
    """Fetch a lead's field data by leadgen id."""
    data = _request(
        f"{GRAPH_BASE}/{leadgen_id}",
        {"access_token": access_token, "fields": "id,created_time,field_data,form_id,ad_id,page_id"},
    )
    fields = {}
    for entry in data.get("field_data") or []:
        name = (entry.get("name") or "").strip().lower()
        values = entry.get("values") or []
        if name and values:
            fields[name] = values[0]
    return {
        "id": str(data.get("id") or leadgen_id),
        "created_time": data.get("created_time"),
        "form_id": str(data.get("form_id") or "") or None,
        "page_id": str(data.get("page_id") or "") or None,
        "fields": fields,
    }
