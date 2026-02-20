from playwright.sync_api import sync_playwright, expect
import time

def test_start_button_appearance():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to ensure elements are visible
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        try:
            print("Navigating to home page...")
            page.goto("http://localhost:5173", timeout=60000)

            # Wait for page load
            page.wait_for_load_state("networkidle")

            # Look for the Start button "開始"
            start_button = page.get_by_role("button", name="開始").first

            # If not visible, maybe we need to click a unit tab.
            if not start_button.is_visible():
                print("Start button not visible. Checking tabs...")
                # Find tabs. The first one might be '講義資料のみ' (Slide only) or a unit.
                # If we are on slide-only, we won't see exams.

                # Check current selected tab style?
                # Or just click the second tab if it exists.
                tabs = page.get_by_role("tab")
                count = tabs.count()
                print(f"Found {count} tabs.")

                if count > 1:
                    print("Clicking the second tab...")
                    tabs.nth(1).click()
                    time.sleep(1) # Wait for render

            print("Waiting for Start button to be visible...")
            expect(start_button).to_be_visible(timeout=10000)

            # Hover over the button to trigger hover state?
            # Playwright screenshot might not capture hover unless we force it.
            # But just normal state is fine for now.
            # I can take two screenshots. One normal, one hover.

            print("Taking normal screenshot...")
            start_button.scroll_into_view_if_needed()
            page.screenshot(path="/home/jules/verification/start_button_normal.png")

            print("Taking hover screenshot...")
            start_button.hover()
            time.sleep(0.5)
            page.screenshot(path="/home/jules/verification/start_button_hover.png")

            print("Screenshots saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_state.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    test_start_button_appearance()
