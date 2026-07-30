import os
from supabase import create_client

_supabase = None

def _get_client():
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if url and key:
            _supabase = create_client(url, key)
    return _supabase

SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "realtyhub-images")

def upload_file(file_obj, path: str) -> str:
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    client.storage.from_(SUPABASE_BUCKET).upload(path, file_obj)
    supabase_url = os.environ.get("SUPABASE_URL", "")
    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{path}"

def delete_file(path: str):
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    client.storage.from_(SUPABASE_BUCKET).remove([path])

def rename_file(old_path: str, new_path: str) -> str:
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    client.storage.from_(SUPABASE_BUCKET).move(old_path, new_path)
    supabase_url = os.environ.get("SUPABASE_URL", "")
    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{new_path}"

def list_files(folder: str = "") -> list:
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    return client.storage.from_(SUPABASE_BUCKET).list(folder)

def create_folder(path: str):
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    client.storage.from_(SUPABASE_BUCKET).upload(f"{path}/.placeholder", b"")

def delete_folder(path: str):
    client = _get_client()
    if client is None:
        raise RuntimeError("Supabase not configured")
    items = client.storage.from_(SUPABASE_BUCKET).list(path)
    paths = [f"{path}/{item['name']}" for item in items]
    if paths:
        client.storage.from_(SUPABASE_BUCKET).remove(paths)
