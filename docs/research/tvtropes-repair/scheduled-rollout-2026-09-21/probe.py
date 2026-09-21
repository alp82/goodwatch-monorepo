import asyncio, hashlib
from playwright.async_api import async_playwright
from f.tvtropes_web.title_variations import title_variations
async def probe():
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        context=await browser.new_context()
        page=await context.new_page()
        try:
            response=await page.goto("https://tvtropes.org/pmwiki/pmwiki.php/Film/ChubbyGotGuts",wait_until="domcontentloaded",timeout=45000)
            html=await page.content()
            return {"status":response.status,"url":page.url,"page_title":await page.title(),"managed_challenge":"challenge-platform" in html,"source_sha256":hashlib.sha256(html.encode()).hexdigest(),"helper_candidates":title_variations(["12 Angry Men"]),"requests":1,"database_writes":0}
        finally:
            await context.close()
            await browser.close()
def main():
    return asyncio.run(probe())
