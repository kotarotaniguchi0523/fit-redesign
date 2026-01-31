import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173")
        await page.wait_for_timeout(1000)

        # Helper to click button by text
        async def click_text(text):
            await page.get_by_role("button", name=text, exact=True).click()
            await page.wait_for_timeout(500)

        async def click_exam_tab(num):
             # Try to find button containing "小テスト{num}"
             # The button text is "小テスト{num}\n{Title}"
             # We can use text selector with partial match or exact ID if available.
             # The code didn't set IDs on exam tabs, but aria-label="小テスト選択" contains them.
             # Let's search inside the group.

             # Locate the group
             group = page.get_by_role("tablist", name="小テスト選択")
             if await group.count() > 0:
                 # Find button that starts with "小テスト{num}"
                 # The text content is split in spans.
                 # Let's try locating by text "小テスト{num}" inside the button
                 btn = group.locator("button").filter(has_text=f"小テスト{num}")
                 if await btn.count() > 0:
                     await btn.click()
                     await page.wait_for_timeout(500)

        async def capture(selector, filename):
             # Open answer
             btn = page.locator(selector).locator("button[aria-label='Show answer']")
             if await btn.count() > 0:
                 if await btn.is_visible():
                     await btn.click()
                     await page.wait_for_timeout(500)

             el = page.locator(selector)
             if await el.count() > 0:
                 await el.screenshot(path=filename)
                 print(f"Captured {filename}")
             else:
                 print(f"Failed to find {selector}")

        # 1. Automaton 2014 Q5
        print("Capturing Automaton 2014 Q5...")
        await click_text("オートマトン")
        await click_text("2014年度")
        # Automaton 2014 mapping: [6]. Default is 6.
        await capture("#exam6-2014-q5", "verification/verification_exam6_2014_q5.png")

        # 2. Data Structure 2017 Q1
        print("Capturing Data Structure 2017 Q1...")
        await click_text("データ構造")
        await click_text("2017年度")
        # Mapping [5, 6, 8]. Default 5. Click 8.
        await click_exam_tab(8)
        await capture("#exam8-2017-q1", "verification/verification_exam8_2017_q1.png")

        # 3. Data Structure 2014 Q3
        print("Capturing Data Structure 2014 Q3...")
        # Still in Data Structure unit
        await click_text("2014年度")
        # Mapping [6, 8]. Default 6. Click 8.
        await click_exam_tab(8)
        await capture("#exam8-2014-q3", "verification/verification_exam8_2014_q3.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
