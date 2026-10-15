"""Naming convention for generated image variants (no storage dependencies).

An original ``properties/123_abc.jpg`` yields:
    properties/123_abc.card.webp
    properties/123_abc.full.webp
"""

import os

# variant name -> max width in pixels (height is scaled proportionally)
VARIANT_WIDTHS = {"card": 600, "full": 1600}
VARIANT_NAMES = tuple(VARIANT_WIDTHS)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def is_image_path(path):
    return os.path.splitext(path or "")[1].lower() in IMAGE_EXTS


def variant_path(path, name):
    root, _ext = os.path.splitext(path)
    return f"{root}.{name}.webp"


def variant_paths(path):
    """All variant storage paths derived from an original image path."""
    if not is_image_path(path):
        return []
    return [variant_path(path, name) for name in VARIANT_NAMES]
