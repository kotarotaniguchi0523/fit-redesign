from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 1200})

        print("Navigating to home...")
        page.goto("http://localhost:3000")
        page.wait_for_selector("text=単元1", timeout=10000)

        # --- 1. Automaton (Exam 6 2013) ---
        print("Navigating to Automaton 2013...")
        # Click Unit 6 button (find by text "オートマトン")
        page.get_by_role("tab", name="オートマトン").click()
        time.sleep(1)
        # Click 2013 year
        page.get_by_label("2013年度").click()
        time.sleep(1)

        # Locate the State Diagram (Question 3)
        # Text: 以下の状態遷移図で定義される有限オートマトンがある
        print("Locating State Diagram...")
        try:
            q3_text = page.locator("text=以下の状態遷移図で定義される有限オートマトンがある")
            q3_text.wait_for(state="visible", timeout=5000)
            # Get the card containing it
            q3_card = q3_text.locator("xpath=ancestor::div[contains(@class, 'border-l-4')]")
            q3_card.screenshot(path="verification/automaton_initial.png")
            print("Captured automaton_initial.png")
        except Exception as e:
            print(f"Failed to capture Automaton: {e}")
            page.screenshot(path="verification/automaton_fail.png")

        # --- 2. Tree (Exam 8 2016) ---
        print("Navigating to Data Structure 2016...")
        # Click Unit 8 button ("データ構造")
        page.get_by_role("tab", name="データ構造").click()
        time.sleep(1)
        # Click 2016 year
        page.get_by_label("2016年度").click()
        time.sleep(1)

        # Locate a Binary Tree question
        # I suspect it's Q3 based on exam8-2013 but let's just look for any binary tree SVG
        # Or look for text "二分木"
        print("Locating Binary Tree...")
        try:
            tree_text = page.locator("text=二分木").first
            tree_text.wait_for(state="visible", timeout=5000)
             # Get the card containing it
            tree_card = tree_text.locator("xpath=ancestor::div[contains(@class, 'border-l-4')]")
            tree_card.screenshot(path="verification/tree_initial.png")
            print("Captured tree_initial.png")
        except Exception as e:
            print(f"Failed to capture Tree: {e}")
            page.screenshot(path="verification/tree_fail.png")

        # --- 3. Settings Menu ---
        print("Opening Settings Menu...")
        # Use the first settings button on the page
        try:
            # We are on Data Structure 2016 page. There should be questions.
            settings_btn = page.get_by_role("button", name="設定").first
            settings_btn.click()
            time.sleep(1) # Wait for animation
            # Capture the area around the button and the dropdown
            # We'll just capture the viewport or a specific region
            page.screenshot(path="verification/settings_initial.png")
            print("Captured settings_initial.png")
        except Exception as e:
             print(f"Failed to capture Settings: {e}")
             page.screenshot(path="verification/settings_fail.png")

        browser.close()

if __name__ == "__main__":
    run()
