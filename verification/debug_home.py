from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 1200})

        print("Navigating to home...")
        try:
            page.goto("http://localhost:3000", timeout=60000) # Increased timeout
            page.wait_for_load_state("networkidle")
            page.screenshot(path="verification/home_debug.png")
            print("Captured home_debug.png")
        except Exception as e:
            print(f"Error loading home: {e}")
            page.screenshot(path="verification/home_error.png")

if __name__ == "__main__":
    run()
