import os
import shutil

_supabase = None

def _get_client():
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if url and key:
            from supabase import create_client
            _supabase = create_client(url, key)
    return _supabase

SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "realtyhub-images")

def _local_enabled():
    return _get_client() is None

def _local_root():
    return os.path.join(os.getcwd(), "uploads")

def _local_abs(path: str) -> str:
    return os.path.join(_local_root(), path)

def _local_url(path: str) -> str:
    return f"uploads/{path}"

def upload_file(file_obj, path: str, overwrite: bool = False) -> str:
    if _local_enabled():
        dest = _local_abs(path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        file_obj.save(dest)
        return _local_url(path)
    client = _get_client()
    data = file_obj.read() if hasattr(file_obj, "read") else file_obj
    if overwrite:
        client.storage.from_(SUPABASE_BUCKET).update(path, data)
    else:
        client.storage.from_(SUPABASE_BUCKET).upload(path, data)
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{path}"

def delete_file(path):
    paths = list(path) if isinstance(path, (list, tuple)) else [path]
    if _local_enabled():
        for p in paths:
            dest = _local_abs(p)
            if os.path.exists(dest):
                os.remove(dest)
        return
    client = _get_client()
    client.storage.from_(SUPABASE_BUCKET).remove(paths)

def rename_file(old_path: str, new_path: str) -> str:
    if _local_enabled():
        src = _local_abs(old_path)
        dest = _local_abs(new_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(src):
            os.rename(src, dest)
        return _local_url(new_path)
    client = _get_client()
    client.storage.from_(SUPABASE_BUCKET).move(old_path, new_path)
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{new_path}"

def list_files(folder: str = "") -> list:
    if _local_enabled():
        base = _local_abs(folder)
        if not os.path.isdir(base):
            return []
        items = []
        for name in sorted(os.listdir(base)):
            full = os.path.join(base, name)
            items.append({"name": name, "id": None if os.path.isdir(full) else name})
        return items
    client = _get_client()
    return client.storage.from_(SUPABASE_BUCKET).list(folder)

def create_folder(path: str):
    if _local_enabled():
        os.makedirs(_local_abs(path), exist_ok=True)
        return
    client = _get_client()
    client.storage.from_(SUPABASE_BUCKET).upload(f"{path}/.placeholder", b"")

def delete_folder(path: str):
    if _local_enabled():
        dest = _local_abs(path)
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        return
    client = _get_client()
    items = client.storage.from_(SUPABASE_BUCKET).list(path)
    paths = [f"{path}/{item['name']}" for item in items]
    if paths:
        client.storage.from_(SUPABASE_BUCKET).remove(paths)
