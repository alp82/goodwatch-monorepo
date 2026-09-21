# requirements:
# playwright==1.62.0
import asyncio, os, time
from playwright.async_api import async_playwright
UA = "GoodWatchBot/0.1 (+https://goodwatch.app; contact alportac@gmail.com)"
URL = "https://tvtropes.org/pmwiki/pmwiki.php/Series/BreakingBad"
async def probe():
    out = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name, ua in (("default-headless", None), ("honest-ua", UA)):
            context = await browser.new_context(**({"user_agent": ua} if ua else {}))
            page = await context.new_page()
            r = await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
            out.append({"case": name, "status": r.status, "cf_mitigated": r.headers.get("cf-mitigated"),
                        "cf_ray": r.headers.get("cf-ray"), "title": await page.title(),
                        "twikilinks": await page.locator("#main-article a.twikilink").count(),
                        "sent_ua": await page.evaluate("navigator.userAgent")})
            await context.close()
            if ua is None:
                await asyncio.sleep(6)
        await browser.close()
    return {"worker": os.environ.get("WM_WORKER_NAME"), "requests": 2, "database_writes": 0, "results": out}
def main():
    return asyncio.run(probe())
