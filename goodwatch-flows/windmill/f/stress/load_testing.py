# extra_requirements:
# playwright==1.45.1

import asyncio
import time
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# List of URLs to test
URLS = [
    "https://goodwatch.app/",
    "https://goodwatch.app/discover",
    "https://goodwatch.app/movies",
    "https://goodwatch.app/tv-shows",
    "https://goodwatch.app/movies/moods",
    "https://goodwatch.app/tv-shows/moods",
]

DEFAULT_LOAD_TIMEOUT_SECONDS = 30

async def visit_url_worker(browser, url, worker_id, end_time):
    """A worker that repeatedly visits a URL until end_time."""
    logging.info(f"Worker {worker_id} for URL {url} starting.")
    context = None
    page = None
    try:
        # Create a new isolated browser context for each worker
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' # Example
            # Add other context options if needed (viewport, permissions, etc.)
        )
        page = await context.new_page()

        while time.time() < end_time:
            start_time = time.time()
            status = None
            try:
                # Navigate to the URL. Playwright handles JS execution, resource loading etc.
                response = await page.goto(url, timeout=DEFAULT_LOAD_TIMEOUT_SECONDS * 1000, wait_until='domcontentloaded')
                status = response.status if response else 'No response'
                # Optional: wait for a specific element or condition after load
                # await page.wait_for_selector('body', timeout=5000)
                duration = time.time() - start_time
                logging.info(f"Worker {worker_id} visited {url} - Status: {status} (duration: {duration:.2f}s)")

            except Exception as e:
                duration = time.time() - start_time
                logging.error(f"Worker {worker_id} error visiting {url}: {e} (duration: {duration:.2f}s)")
                # Optional: Add a small delay after errors
                await asyncio.sleep(1)
                # Decide if you need to recreate page/context on certain errors

            # Optional: Add a small delay between requests within the same worker
            # await asyncio.sleep(0.5)

    except Exception as e:
         logging.error(f"Worker {worker_id} critical error: {e}")
    finally:
        if page:
            await page.close()
        if context:
            await context.close()
        logging.info(f"Worker {worker_id} for URL {url} finished.")


async def run_load_test(duration: int, concurrency: int):
    end_time = time.time() + duration
    tasks = []

    async with async_playwright() as p:
        # Launch the browser (defaults to Chromium if Chrome isn't explicitly specified and found)
        # You might specify executable_path if needed, or channel="chrome"
        browser = await p.chromium.launch(headless=True) # Or p.webkit or p.firefox
        logging.info(f"Browser launched: {browser.version}")

        worker_count = 0
        for url in URLS:
            for i in range(concurrency):
                task = asyncio.create_task(visit_url_worker(browser, url, worker_count, end_time))
                tasks.append(task)
                worker_count += 1

        logging.info(f"Launched {len(tasks)} workers. Running for {duration} seconds...")
        await asyncio.gather(*tasks) # Wait for all workers to complete

        await browser.close()
        logging.info("Load testing completed.")

    return {"status": "Success (Playwright Load Test)"} # Windmill expects a JSON serializable return

def main(duration = 120, concurrency=5):
    asyncio.run(run_load_test(duration=duration, concurrency=concurrency))

