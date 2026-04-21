#!/usr/bin/env python3
"""
Process images that need it: resize if > 2400px on widest side, fix EXIF rotation.
Only touches images that actually require a change. Re-saves as JPEG via mozjpeg at 90%.
"""

import os
import subprocess
import sys
import tempfile
from PIL import Image, ImageOps

MOZJPEG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "node_modules/mozjpeg/vendor/cjpeg",
)
IMAGES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "images"
)
MAX_SIZE = 2400
QUALITY = 90
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".bmp"}


def get_exif_rotation(img):
    try:
        exif = img.getexif()
        if exif:
            return exif.get(0x0112, 1)  # Orientation tag
    except Exception:
        pass
    return 1


def needs_processing(img):
    w, h = img.size
    if max(w, h) > MAX_SIZE:
        return True
    if get_exif_rotation(img) not in (1, None):
        return True
    return False


def process_image(filepath):
    with Image.open(filepath) as img:
        if not needs_processing(img):
            return None

        original_size = img.size
        img = ImageOps.exif_transpose(img)

        w, h = img.size
        if max(w, h) > MAX_SIZE:
            if w >= h:
                new_size = (MAX_SIZE, round(h * MAX_SIZE / w))
            else:
                new_size = (round(w * MAX_SIZE / h), MAX_SIZE)
            img = img.resize(new_size, Image.LANCZOS)

        if img.mode != "RGB":
            img = img.convert("RGB")

        with tempfile.NamedTemporaryFile(suffix=".ppm", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            img.save(tmp_path, format="PPM")
        except Exception:
            os.unlink(tmp_path)
            raise

    base, ext = os.path.splitext(filepath)
    out_path = filepath if ext.lower() in {".jpg", ".jpeg"} else base + ".jpg"

    result = subprocess.run(
        [MOZJPEG, "-quality", str(QUALITY), "-outfile", out_path, tmp_path],
        capture_output=True,
    )
    os.unlink(tmp_path)

    if result.returncode != 0:
        raise RuntimeError(f"mozjpeg failed: {result.stderr.decode()}")

    if ext.lower() not in {".jpg", ".jpeg"}:
        os.unlink(filepath)

    resized = max(original_size) > MAX_SIZE
    return original_size, img.size, resized


def main():
    files = []
    for root, _, filenames in os.walk(IMAGES_DIR):
        for filename in filenames:
            if os.path.splitext(filename)[1].lower() in IMAGE_EXTS:
                files.append(os.path.join(root, filename))

    files.sort()
    total = len(files)
    processed = 0
    resized_count = 0
    errors = []

    for i, filepath in enumerate(files, 1):
        rel = os.path.relpath(filepath, IMAGES_DIR)
        try:
            result = process_image(filepath)
            if result is None:
                continue
            orig_size, new_size, resized = result
            processed += 1
            if resized:
                resized_count += 1
                print(f"RESIZED {rel}: {orig_size} -> {new_size}")
            else:
                print(f"EXIF    {rel}: {orig_size}")
        except Exception as e:
            errors.append((rel, str(e)))
            print(f"ERROR   {rel}: {e}", file=sys.stderr)

    print(f"\nDone: {processed}/{total} images changed ({resized_count} resized)")
    if errors:
        print(f"{len(errors)} errors:")
        for path, msg in errors:
            print(f"  {path}: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
