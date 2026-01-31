import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Set viewport to see diagrams clearly
        await page.set_viewport_size({"width": 1280, "height": 1200})

        print("Navigating to home...")
        await page.goto("http://localhost:5173")
        await page.wait_for_load_state("networkidle")

        # --- Exam 6 2014 Q5 ---
        print("\n--- Capturing Exam 6 2014 Q5 (FSM) ---")
        try:
            print("Clicking 'オートマトン'...")
            await page.click("text=オートマトン")
            await page.wait_for_timeout(1000)

            print("Clicking '2014年度'...")
            await page.click("text=2014年度")
            await page.wait_for_timeout(1000)

            print("Locating Q5...")
            q5 = page.locator("text=次の状態遷移表を表す状態遷移図を書け")
            await q5.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            await page.screenshot(path="verification/final_exam6_2014_q5.png")
            print("Saved final_exam6_2014_q5.png")

        except Exception as e:
            print(f"Error capturing Exam 6 2014: {e}")
            await page.screenshot(path="verification/error_exam6_2014_final.png")

        # --- Exam 8 2017 Q1 ---
        print("\n--- Capturing Exam 8 2017 Q1 (Tree) ---")
        try:
            print("Clicking 'データ構造'...")
            await page.click("text=データ構造")
            await page.wait_for_timeout(1000)

            print("Clicking '2017年度'...")
            await page.click("text=2017年度")
            await page.wait_for_timeout(1000)

            # Exam 8 button check
            exam8_btn = page.locator("button").filter(has_text="小テスト8")
            if await exam8_btn.count() > 0:
                 if await exam8_btn.is_visible():
                    print("Clicking '小テスト8'...")
                    await exam8_btn.click()
                    await page.wait_for_timeout(1000)

            print("Locating Q1...")
            q1 = page.locator("text=次の順にデータを挿入した二分探索木を")
            await q1.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            await page.screenshot(path="verification/final_exam8_2017_q1.png")
            print("Saved final_exam8_2017_q1.png")

        except Exception as e:
            print(f"Error capturing Exam 8 2017: {e}")
            await page.screenshot(path="verification/error_exam8_2017_final.png")

        # --- Exam 8 2014 Q3 ---
        print("\n--- Capturing Exam 8 2014 Q3 (Tree) ---")
        try:
            # Already on Data Structure. Switch to 2014.
            print("Clicking '2014年度'...")
            await page.click("text=2014年度")
            await page.wait_for_timeout(1000)

            # Exam 8 button check again (since year changed, buttons might change)
            exam8_btn = page.locator("button").filter(has_text="小テスト8")
            if await exam8_btn.count() > 0:
                 if await exam8_btn.is_visible():
                    print("Clicking '小テスト8'...")
                    await exam8_btn.click()
                    await page.wait_for_timeout(1000)

            print("Locating Q3...")
            q3 = page.locator("text=空の二分木に次の順でデータを追加した時")
            await q3.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            await page.screenshot(path="verification/final_exam8_2014_q3.png")
            print("Saved final_exam8_2014_q3.png")

        except Exception as e:
            print(f"Error capturing Exam 8 2014: {e}")
            await page.screenshot(path="verification/error_exam8_2014_final.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
