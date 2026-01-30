from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 1200})

        def wait_for_ready():
             time.sleep(2)

        print("Navigating to home...")
        page.goto("http://localhost:3000")
        wait_for_ready()

        # --- 2. Tree (Exam 8 2016) ---
        print("Navigating to Data Structure 2016...")
        page.get_by_role("tab", name="データ構造").click()
        wait_for_ready()
        page.get_by_text("2016年度").click()
        wait_for_ready()

        try:
            # Search for the numbers in the question text
            tree_text = page.locator("text=27, 7, 51").first
            tree_text.wait_for(state="visible", timeout=5000)
            tree_card = tree_text.locator("xpath=ancestor::div[contains(@class, 'border-l-4')]")
            tree_card.screenshot(path="verification/final_tree.png")
            print("Captured final_tree.png")

            # --- 3. Settings Menu ---
            print("Opening Settings Menu...")
            settings_btn = tree_card.get_by_role("button", name="タイマー設定")
            settings_btn.click()
            time.sleep(1) # Wait for popover

            page.screenshot(path="verification/final_settings.png")
            print("Captured final_settings.png")

        except Exception as e:
            print(f"Failed to capture Tree/Settings: {e}")
            page.screenshot(path="verification/debug_tree_fail.png")

        browser.close()

if __name__ == "__main__":
    run()
