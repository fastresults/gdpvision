"""Capture consistent 16:9 marketing plates for all ten GDPVision chambers.

Prerequisite: mint an approved local preview session with `lovable auth-session`.
Outputs stay in /tmp for privacy review before upload with `lovable-assets`.
"""

import asyncio
import json
import os
from pathlib import Path

from PIL import Image, ImageOps
from playwright.async_api import async_playwright


BASE_URL = "http://localhost:8080"
COUNTRY_CODE = os.environ.get("GDPVISION_CAPTURE_COUNTRY", "ATG")
OUTPUT_DIR = Path("/tmp/gdpvision-chamber-screens")
SESSION_FILE = Path.home() / ".cache/lovable-auth/session.json"

ROUTES = {
    "01": "ledger",
    "02": "portfolio",
    "03": "scenarios",
    "04": "studio",
    "05": "narrative",
    "06": "cabinet",
    "07": "personas",
    "08": "mandate-compact",
    "09": "egov",
    "10": "sector",
}

CROPS = {
    "01": (80, 74, 1280, 749),
    "02": (396, 160, 1280, 657),
    **{index: (0, 64, 1280, 784) for index in ROUTES if index not in {"01", "02"}},
}


async def capture() -> None:
    if not SESSION_FILE.exists():
        raise SystemExit("Mint an approved preview session before capturing chamber screens.")

    session = json.loads(SESSION_FILE.read_text())
    raw_dir = OUTPUT_DIR / "raw"
    final_dir = OUTPUT_DIR / "review"
    raw_dir.mkdir(parents=True, exist_ok=True)
    final_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        cookies = session.get("cookies", [])
        for cookie in cookies:
            cookie["url"] = BASE_URL
        if cookies:
            await context.add_cookies(cookies)

        page = await context.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            "({ key, value }) => localStorage.setItem(key, JSON.stringify(value))",
            {"key": session["storage_key"], "value": session["session"]},
        )

        for index, chamber_path in ROUTES.items():
            route = f"/admin/countries/{COUNTRY_CODE}/{chamber_path}"
            await page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)
            raw_path = raw_dir / f"chamber-{index}.png"
            await page.screenshot(path=str(raw_path), full_page=False)

            source = Image.open(raw_path).convert("RGB")
            box = CROPS[index]
            canvas = Image.new(
                "RGB",
                (max(source.width, box[2]), max(source.height, box[3])),
                (252, 252, 250),
            )
            canvas.paste(source, (0, 0))
            plate = ImageOps.fit(
                canvas.crop(box),
                (1280, 720),
                method=Image.Resampling.LANCZOS,
            )
            plate.save(final_dir / f"chamber-{index}.webp", "WEBP", quality=82, method=6)
            print(f"Captured Chamber {index}: {route}")

        await browser.close()

    print(f"Review privacy and composition before upload: {final_dir}")


asyncio.run(capture())