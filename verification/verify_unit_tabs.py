from playwright.sync_api import sync_playwright, expect

def verify_unit_tabs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Navigate to the app
            print("Navigating to http://localhost:5173/")
            page.goto("http://localhost:5173/")

            # Wait for the page to load
            page.wait_for_load_state("networkidle")

            # Click on a Unit Tab (e.g., 'ソート・探索')
            print("Looking for tab 'ソート・探索'")
            # Use specific locator if role fails
            tab = page.get_by_role("tab", name="ソート・探索")

            if tab.is_visible():
                print("Tab found, clicking...")
                tab.click()
            else:
                print("Tab not found by role. Trying specific selector or text...")
                # Try locating by text only
                tab = page.get_by_text("ソート・探索")
                if tab.is_visible():
                    print("Tab found by text, clicking...")
                    tab.click()
                else:
                    print("Tab not found at all.")
                    return

            # Wait for content to update
            page.wait_for_timeout(1000) # Wait a bit for React to update state

            # Check for year selector
            print("Verifying year selector")
            # Look for "2013年度" which is visible in the screenshot
            year_label = page.get_by_text("2013年度")

            if year_label.is_visible():
                print("Year 2013年度 found.")
            else:
                print("Year 2013年度 not found.")
                raise Exception("Year selector verification failed")

            # Take final screenshot
            screenshot_path = "verification/unit_tabs_verified.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_unit_tabs()
