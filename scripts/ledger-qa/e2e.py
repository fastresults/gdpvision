"""Headless E2E for /admin/ledger-qa.

Restores the injected Supabase session, opens the page, clicks
"Run all reads" and "Simulate cold-start", and asserts the summary
strips render with non-zero counts and no fails.
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/ledger-qa")
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})

        cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies: c["url"] = "http://localhost:8080"
            await ctx.add_cookies(cookies)

        page = await ctx.new_page()
        console_errs = []
        page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)

        await page.goto("http://localhost:8080")
        sk = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sj = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if sk and sj:
            await page.evaluate(f"window.localStorage.setItem({json.dumps(sk)}, {json.dumps(sj)})")

        await page.goto("http://localhost:8080/admin/ledger-qa", wait_until="domcontentloaded")
        await page.wait_for_selector("text=Chamber 01 v2 acceptance", timeout=15000)
        # wait for at least one check row to render (checks count in header)
        await page.wait_for_selector("text=/\\d+ checks/", timeout=15000)
        await page.screenshot(path=str(OUT/"1_loaded.png"))

        # Click Run all reads
        await page.get_by_role("button", name="Run all reads").click()
        # Wait for summary strip
        await page.wait_for_selector("text=Run all reads · ", timeout=30000)
        strip = await page.locator("div.font-mono.text-\\[11px\\]").filter(has_text="Run all reads · ").first.inner_text()
        await page.screenshot(path=str(OUT/"2_run_all.png"))

        m = re.search(r"(\d+) pass · (\d+) warn · (\d+) fail", strip)
        assert m, f"could not parse summary strip: {strip!r}"
        p, w, f = map(int, m.groups())
        print(f"[run-all] pass={p} warn={w} fail={f}")
        assert p + w + f > 0, "empty summary"

        # Click Simulate cold-start
        await page.get_by_role("button", name="Simulate cold-start").click()
        await page.wait_for_selector("text=Cold-start timeline · ", timeout=60000)
        # wait until timeline stops growing (no Cancel button visible = done)
        for _ in range(60):
            visible = await page.get_by_role("button", name="Cancel").is_visible()
            if not visible: break
            await asyncio.sleep(1)
        await page.screenshot(path=str(OUT/"3_cold_start.png"))
        tl = await page.locator("text=Cold-start timeline · ").first.inner_text()
        m2 = re.search(r"(\d+) step\(s\) · (\d+)ms total", tl)
        assert m2, f"could not parse timeline: {tl!r}"
        steps, total_ms = map(int, m2.groups())
        print(f"[cold-start] steps={steps} total_ms={total_ms}")
        assert steps >= 7, f"expected ≥7 read-check steps, got {steps}"
        # Guardrail: 800ms fake-clock regression would be exactly 800×steps
        assert total_ms != 800 * steps, "timeline latency looks like fake-clock"

        if console_errs:
            print("console errors:")
            for e in console_errs[:20]: print("  ", e)

        await browser.close()
        # exit non-zero if there were fails
        sys.exit(1 if f > 0 else 0)

asyncio.run(main())
