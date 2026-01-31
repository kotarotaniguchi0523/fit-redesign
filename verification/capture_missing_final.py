import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1280, "height": 1200})

        await page.goto("http://localhost:5173")
        await page.wait_for_load_state("networkidle")

        # --- Exam 8 2014 Q3 ---
        print("\n--- Capturing Exam 8 2014 Q3 (Tree) ---")
        try:
            # Click Data Structure Tab
            print("Clicking 'データ構造'...")
            await page.click("text=データ構造")
            await page.wait_for_timeout(1000)

            # Click 2014 Year
            print("Clicking '2014年度'...")
            await page.click("text=2014年度")
            await page.wait_for_timeout(1000)

            # Click Exam 8 sub-tab if it exists
            print("Checking for Exam 8 sub-tab...")
            # Locator for the button containing "小テスト8"
            exam8_btn = page.locator("button").filter(has_text="小テスト8")
            if await exam8_btn.count() > 0:
                print("Clicking '小テスト8'...")
                await exam8_btn.click()
                await page.wait_for_timeout(1000)
            else:
                print("'小テスト8' button not found (might be default or single).")

            # Scroll to Q3
            print("Locating Q3...")
            q3 = page.locator("text=空の二分木に次の順でデータを追加した時")
            await q3.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            # Capture
            await page.screenshot(path="verification/initial_exam8_2014_q3.png")
            print("Saved initial_exam8_2014_q3.png")

        except Exception as e:
            print(f"Error capturing Exam 8 2014: {e}")
            await page.screenshot(path="verification/error_exam8_2014_final.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
