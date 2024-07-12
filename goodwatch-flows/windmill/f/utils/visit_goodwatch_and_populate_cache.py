# extra_requirements:
# playwright==1.40.0

import asyncio
from playwright.async_api import async_playwright, BrowserContext

BROWSER_TIMEOUT_MS = 30000
PAGE_SLEEP_SEC = 10


async def visit_page(url: str, browser: BrowserContext):
    page = await browser.new_page()
    response = await page.goto(url)
    if response.status != 200:
        print(f"Failure: {url} had status code {response.status}")
    else:
        print(f"Success: {url} successfully visited and cache populated")


async def visit_pages(urls: list[str]):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT_MS)

        try:
            for url in urls:
                await visit_page(url=url, browser=browser)
                await asyncio.sleep(PAGE_SLEEP_SEC)
        finally:
            await context.close()
            await browser.close()


def main():
    urls = [
        "https://goodwatch.app",
        "https://goodwatch.app/discover",
    ]
    asyncio.run(visit_pages(urls=urls))
