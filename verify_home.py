from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5174/")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification_home.png")
        browser.close()

if __name__ == "__main__":
    run()
