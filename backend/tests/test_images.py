"""Tests for WebP variant generation and storage variant cleanup."""

import io

import pytest
from PIL import Image

from utils import image_paths, images, supabase_storage


def _png_bytes(size=(1200, 800), color=(200, 100, 50)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def local_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(supabase_storage, "_get_client", lambda: None)
    monkeypatch.setattr(supabase_storage, "_local_root", lambda: str(tmp_path))
    return tmp_path


def test_image_path_helpers():
    assert image_paths.is_image_path("a/b/c.JPG")
    assert not image_paths.is_image_path("a/b/c.pdf")
    assert image_paths.variant_path("a/b/c.jpg", "card") == "a/b/c.card.webp"
    assert image_paths.variant_paths("a/b/c.jpg") == [
        "a/b/c.card.webp",
        "a/b/c.full.webp",
    ]
    assert image_paths.variant_paths("a/b/c.pdf") == []


def test_process_image_upload_generates_variants(local_storage):
    url = images.process_image_upload(io.BytesIO(_png_bytes()), "properties/x.png")
    assert url == "uploads/properties/x.png"
    assert (local_storage / "properties" / "x.png").exists()
    for name in image_paths.VARIANT_NAMES:
        variant = local_storage / "properties" / f"x.{name}.webp"
        assert variant.exists()
        with Image.open(variant) as im:
            assert im.format == "WEBP"
            assert im.width <= image_paths.VARIANT_WIDTHS[name]


def test_process_image_upload_non_image_skips_variants(local_storage):
    url = images.process_image_upload(io.BytesIO(b"%PDF-1.4 not an image"), "docs/x.pdf")
    assert url == "uploads/docs/x.pdf"
    assert (local_storage / "docs" / "x.pdf").exists()
    assert not (local_storage / "docs" / "x.card.webp").exists()


def test_process_image_upload_accepts_bytes(local_storage):
    url = images.process_image_upload(_png_bytes(), "properties/raw.jpg")
    assert url == "uploads/properties/raw.jpg"
    assert (local_storage / "properties" / "raw.jpg").exists()


def test_delete_file_removes_variants(local_storage):
    d = local_storage / "properties"
    d.mkdir(parents=True)
    (d / "x.jpg").write_bytes(b"orig")
    (d / "x.card.webp").write_bytes(b"c")
    (d / "x.full.webp").write_bytes(b"f")

    supabase_storage.delete_file("properties/x.jpg")

    assert not (d / "x.jpg").exists()
    assert not (d / "x.card.webp").exists()
    assert not (d / "x.full.webp").exists()
