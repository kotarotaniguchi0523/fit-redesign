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
            # Click Automaton Tab (Role is TAB)
            print("Clicking 'オートマトン'...")
            # Use text locator as backup if role fails
            await page.click("text=オートマトン")
            await page.wait_for_timeout(1000)

            # Click 2014 Year (Radio button)
            print("Clicking '2014年度'...")
            # Use text locator because HeroUI Radio might be complex
            await page.click("text=2014年度")
            await page.wait_for_timeout(1000)

            # Scroll to Q5
            print("Locating Q5...")
            q5 = page.locator("text=次の状態遷移表を表す状態遷移図を書け")
            await q5.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            # Capture
            await page.screenshot(path="verification/initial_exam6_2014_q5.png")
            print("Saved initial_exam6_2014_q5.png")

        except Exception as e:
            print(f"Error capturing Exam 6 2014: {e}")
            await page.screenshot(path="verification/error_exam6_2014.png")

        # --- Exam 8 2017 Q1 ---
        print("\n--- Capturing Exam 8 2017 Q1 (Tree) ---")
        try:
            # Click Data Structure Tab
            print("Clicking 'データ構造'...")
            await page.click("text=データ構造")
            await page.wait_for_timeout(1000)

            # Click 2017 Year
            print("Clicking '2017年度'...")
            await page.click("text=2017年度")
            await page.wait_for_timeout(1000)

            # Scroll to Q1
            print("Locating Q1...")
            # Use text snippet
            q1 = page.locator("text=次の順にデータを挿入した二分探索木を")
            await q1.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)

            # Capture
            await page.screenshot(path="verification/initial_exam8_2017_q1.png")
            print("Saved initial_exam8_2017_q1.png")

        except Exception as e:
            print(f"Error capturing Exam 8 2017: {e}")
            await page.screenshot(path="verification/error_exam8_2017.png")

        # --- Exam 8 2014 Q3 ---
        print("\n--- Capturing Exam 8 2014 Q3 (Tree) ---")
        try:
            # We are already on Data Structure tab.
            # Click 2014 Year
            print("Clicking '2014年度'...")
            await page.click("text=2014年度")
            await page.wait_for_timeout(1000)

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
            await page.screenshot(path="verification/error_exam8_2014.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
