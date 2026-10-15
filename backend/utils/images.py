"""Generate responsive WebP variants for uploaded images."""

import logging
from io import BytesIO

from PIL import Image, ImageOps

from utils.image_paths import IMAGE_EXTS, VARIANT_WIDTHS, variant_path
from utils.supabase_storage import upload_file

logger = logging.getLogger("realtyhub")

WEBP_QUALITY = 82


def _open_image(data):
    img = Image.open(BytesIO(data))
    img.load()
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "P", "LA"):
        return img.convert("RGBA")
    return img.convert("RGB")


def process_image_upload(file_obj, path, overwrite=False):
    """Upload an image and its WebP variants; return the original storage URL.

    Falls back to a plain upload when the file is not a supported image or
    when variant generation fails, so uploads never break because of Pillow.
    """
    data = file_obj.read() if hasattr(file_obj, "read") else file_obj
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except Exception:
            pass

    if hasattr(file_obj, "save"):
        source = file_obj
    elif isinstance(data, (bytes, bytearray)):
        source = data
    else:
        source = file_obj
    original_url = upload_file(source, path, overwrite=overwrite)

    ext = ("." + path.rsplit(".", 1)[1].lower()) if "." in path else ""
    if ext not in IMAGE_EXTS:
        return original_url

    try:
        img = _open_image(data)
        for name, width in VARIANT_WIDTHS.items():
            variant = img.copy()
            variant.thumbnail((width, width * 3), Image.LANCZOS)
            buf = BytesIO()
            variant.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
            upload_file(buf.getvalue(), variant_path(path, name), overwrite=True)
    except Exception:
        logger.exception("Failed to generate image variants for %s", path)

    return original_url
