# extra_requirements:
# playwright==1.45.1
import base64
import asyncio
from playwright.async_api import async_playwright

BROWSER_TIMEOUT = 5000

async def make_screenshot(
    url: str,
):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT)
        try:
            page = await browser.new_page()
            response = await page.goto(url)
            await asyncio.sleep(3)
            screenshot_bytes = await page.screenshot()
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
            return screenshot_base64
        finally:
            await context.close()
            await browser.close()

def main(
    url: str,
):
    base64 = asyncio.run(make_screenshot(url=url))
    return {
        "png": base64,
    }