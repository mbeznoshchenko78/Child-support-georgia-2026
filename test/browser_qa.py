"""Release UI tests. Run python test/browser_qa.py with the Playwright Python package.
Use GA_TEST_BROWSER=webkit for WebKit. GA_QA_OUTPUT optionally saves visual proofs."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = "https://review.test/Child-support-georgia-2026/"
DATA = "ga.support.studio.scenarios.v2"
TARGET = os.environ.get("GA_TEST_BROWSER", "chromium")


class BrowserFlows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.driver = sync_playwright().start()
        options = {"headless": True}
        if TARGET == "chromium" and not os.getenv("GA_BUNDLED_BROWSER") and shutil.which("chromium"):
            options["executable_path"] = shutil.which("chromium")
        cls.browser = getattr(cls.driver, TARGET).launch(**options)
        print("Browser", TARGET, cls.browser.version, flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.driver.stop()

    def setUp(self):
        self.context = None
        self.start()

    def start(self, mobile=False, width=1440):
        if self.context:
            self.context.close()
        config = {"viewport": {"width": width, "height": 940}}
        if mobile:
            config = dict(self.driver.devices.get("iPhone 15 Pro Max", {}))
            config.pop("default_browser_type", None)
            config["viewport"] = {"width": width, "height": 932}
            config.update(is_mobile=True, has_touch=True, device_scale_factor=2)
        self.context = self.browser.new_context(**config)
        self.requests = []
        def route(request):
            if request.request.url == URL or request.request.url == (ROOT/"index.html").as_uri():
                request.fulfill(path=ROOT/"index.html", content_type="text/html")
            else:
                self.requests.append(request.request.url)
                request.abort()
        self.context.route("**/*", route)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda err: self.errors.append(str(err)))
        self.page.set_default_timeout(4000)
        self.page.goto(URL)
        self.page.locator(".resultcard").wait_for()
        def action(name):
            scope=self.page.locator("#modal[open]") if self.page.locator("#modal[open]").count() else self.page
            return scope.locator('[data-action="'+name+'"]:visible').first
        self.action = action
        self.key = lambda key: self.page.locator('[data-key="'+key+'"]')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Uncaught page exceptions")
        self.assertEqual(self.requests, [], "Unexpected outgoing requests")

    def fold(self, key):
        self.page.locator('[data-fold="'+key+'"] > summary').first.click()

    def mode(self, mode):
        self.page.locator('[data-action=mode][data-value="'+mode+'"]').click()

    def save(self, name):
        self.action("save").click()
        self.page.locator("#save-form input").fill(name)
        self.page.locator("#save-form button[type=submit]").first.click()
        self.page.locator("dialog").wait_for(state="hidden")

    def shot(self, filename):
        folder = os.environ.get("GA_QA_OUTPUT")
        if folder:
            dest = Path(folder)
            dest.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=dest/(TARGET+"-"+filename+".png"))

    def test_initial_statement_and_clean_storage(self):
        self.assertIn("$414", self.page.locator(".amount").inner_text())
        self.assertIn("$414.11", self.page.locator(".breakdown").inner_text())
        self.assertIsNone(self.page.evaluate("(k) => localStorage.getItem(k)", DATA))
        self.shot("desktop")

    def test_units_keep_exact_salary(self):
        self.page.get_by_role("button", name="Annual", exact=True).click()
        self.key("parents.A.income.salary").fill("100000.01")
        self.page.get_by_role("button", name="Monthly", exact=True).click()
        self.assertAlmostEqual(float(self.key("parents.A.income.salary").input_value()),100000.01/12,places=6)
        self.page.get_by_role("button", name="Annual", exact=True).click()
        self.assertEqual(self.key("parents.A.income.salary").input_value(),"100000.01")

    def test_empty_income_removes_stale_amount(self):
        self.key("parents.A.income.salary").fill("")
        self.assertFalse(self.page.locator("#print-btn").is_enabled())
        self.assertEqual(self.page.locator(".amount").count(),0)
        self.key("parents.A.income.salary").fill("10335")
        self.assertIn("$414",self.page.locator(".amount").inner_text())

    def test_high_income_numeric_and_slider_sync(self):
        self.key("parents.A.income.salary").fill("65000.75")
        self.assertEqual(self.page.locator('[data-range="parents.A.income.salary"]').input_value(),"65000.75")
        self.assertIn("$40,000",self.page.locator("#result").inner_text())
        self.mode("analysis");self.fold("projection");self.key("projection").check()
        self.assertIn("Optional high-income",self.page.locator("#lab-models").inner_text())

    def test_children_and_fractional_days_with_per_child_guard(self):
        self.page.locator('[data-action=children][data-value="2"]').click()
        self.key("daysA").fill("245.375")
        self.assertIn("119.625", self.page.locator("#complement").inner_text())
        self.fold("roles")
        self.action("per-child").check()
        self.key("perChild.1").fill("80")
        self.assertIn("separate worksheets", self.page.locator("#result").inner_text())

    def test_no_order_and_income_breakdown(self):
        self.key("ordered").uncheck()
        self.assertIn("$670",self.page.locator(".amount").inner_text())
        self.fold("income")
        self.key("parents.B.income.bonus").fill("1000")
        self.assertNotIn("$670",self.page.locator(".amount").inner_text())
        self.action("audit").click()
        self.assertIn("$7,250.00",self.page.locator("#modal-body").inner_text())

    def test_mixed_low_income_shows_both_methods(self):
        self.key("parents.A.income.salary").fill("800")
        self.key("parents.B.income.salary").fill("1261.50")
        self.key("daysA").fill("365")
        self.fold("deviations");self.key("deviations.other").fill("50")
        self.assertIn("$239.69",self.page.locator("#result").inner_text())
        self.assertIn("$289.69",self.page.locator("#result").inner_text())

    def test_full_saved_lifecycle_and_comparison(self):
        self.save("Baseline <test>")
        self.action("library").click();self.action("duplicate").click()
        self.page.locator("#save-form input").fill("Variant")
        self.page.locator("#save-form button[type=submit]").click()
        self.action("rename").click();self.page.locator("#save-form input").fill("Baseline & review")
        self.page.locator("#save-form button[type=submit]").click()
        self.action("modal-close").click()
        self.key("parents.B.income.salary").fill("9000")
        self.mode("analysis")
        self.page.locator("[data-compare='0']").check()
        self.assertIn("Baseline & review",self.page.locator("#compare-output table").inner_text())
        self.action("library").click();self.action("load").click();self.action("load-confirm").click()
        self.assertIn("$414",self.page.locator(".amount").inner_text())
        self.action("library").click();self.action("delete-dialog").click();self.action("delete-confirm").click()
        self.page.locator(".savedrow").first.wait_for()
        self.assertEqual(self.page.locator(".savedrow").count(),1)

    def test_import_export_and_clear(self):
        self.save("Portable")
        self.action("library").click()
        with self.page.expect_download() as event:self.action("export").click()
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"export.json";event.value.save_as(path)
            payload=json.loads(path.read_text())
            self.assertEqual(payload["version"],2)
            self.page.locator("#import-file").set_input_files(path)
            self.page.locator(".savedrow").nth(1).wait_for()
        self.action("privacy").click();self.action("clear-dialog").click();self.action("clear-confirm").click()
        self.assertIsNone(self.page.evaluate("(k)=>localStorage.getItem(k)", DATA))

    def test_reject_bad_import_atomically(self):
        self.save("Keep")
        self.action("library").click()
        self.page.locator("#import-file").set_input_files({"name":"invalid.json","mimeType":"application/json","buffer":b"{}"})
        self.page.locator("#modal-error").filter(has_text="fields").wait_for()
        self.assertEqual(self.page.locator(".savedrow").count(),1)

    def test_theme_persists_without_auto_saving_finances(self):
        before=self.page.locator("html").get_attribute("data-theme")
        self.action("theme").click()
        new=self.page.locator("html").get_attribute("data-theme")
        self.assertNotEqual(before,new)
        self.page.reload()
        self.assertEqual(self.page.locator("html").get_attribute("data-theme"),new)
        self.assertIsNone(self.page.evaluate("(k)=>localStorage.getItem(k)", DATA))

    def test_all_sensitivity_axes_heatmap_and_explicit_apply(self):
        self.mode("analysis")
        for axis in ["A","B","days"]:
            self.page.locator('[data-action=axis][data-value="'+axis+'"]').click()
            self.assertTrue(self.page.locator("svg.linechart").is_visible())
        self.page.locator("#heat-parent").select_option("B")
        self.page.locator(".heatcell").first.click()
        self.assertIn("Parent B base pay",self.page.locator("#modal-body").inner_text())
        self.action("heat-apply").click()
        self.assertNotIn("$414 / month",self.page.locator(".amount").inner_text())
        self.shot("lab")

    def test_existing_and_proposed_calendars(self):
        self.mode("court")
        self.action("rule-add").click()
        self.page.locator("#rule-form [name=kind]").select_option("nth")
        self.page.locator("#rule-form [name=name]").fill("Second and fourth weekends")
        self.page.locator("#rule-form button[type=submit]").click()
        self.assertIn("Second and fourth weekends",self.page.locator(".rulelist").inner_text())
        self.action("copy-plan").click();self.action("copy-plan-confirm").click()
        self.action("rule-add").click()
        self.page.locator("#rule-form [name=kind]").select_option("range")
        self.page.locator("#rule-form [name=name]").fill("School break")
        self.page.locator("#rule-form [name=from]").fill("2026-07-01")
        self.page.locator("#rule-form [name=through]").fill("2026-07-09")
        self.page.locator("#rule-form button[type=submit]").click()
        self.assertEqual(self.page.locator(".rulelist li").count(),2)
        self.action("cal-next").click();self.assertIn("February",self.page.locator(".calhead").inner_text())
        self.page.locator('[data-action=apply-plan][data-value=B]').click()
        self.assertIn("proposed plan",self.page.locator(".resultlabel").inner_text())
        self.page.locator('[data-action=plan-tab][data-value=existing]').click()
        self.assertEqual(self.page.locator(".rulelist li").count(),1)

    def test_dated_ledger_evidence_and_reports(self):
        self.mode("court")
        self.key("retro.start").fill("2026-01-01");self.key("retro.end").fill("2026-01-31")
        self.key("retro.monthly").fill("500");self.key("retro.received").fill("50")
        self.action("add-payment").click()
        for name,value in [("date","2026-01-22"),("amount","100"),("note","Statement A")]:
            self.page.locator('#payment-form [name="'+name+'"]').fill(value)
        self.page.locator("#payment-form button").click()
        self.assertIn("$350.00",self.page.locator("#retro-output").inner_text())
        self.page.locator("[data-evidence='0']").check()
        self.key("notes").fill("Bring the updated statement.")
        # The browser's print command renders a standalone set of paper sections.
        self.page.evaluate("window.print=()=>{}")
        self.action("print").click()
        text=self.page.locator("#printout").text_content()
        for term in ["$350.00","Ready · Proposed official","Statement A","Bring the updated statement.","Schedule B","Worksheet audit"]:
            self.assertIn(term,text)

    def test_phone_modes_no_horizontal_overflow_and_touch_targets(self):
        self.start(mobile=True,width=430)
        for mode in ["calculator","analysis","court"]:
            self.mode(mode)
            self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),mode)
            self.assertTrue(self.page.locator("#theme-btn").is_visible())
            if mode=="calculator":
                self.shot("phone")
                self.action("audit").click();self.assertTrue(self.page.locator("dialog").is_visible());self.action("modal-close").click()

    def test_small_phone_and_dark_layout(self):
        self.start(mobile=True,width=375)
        self.action("theme").click()
        self.mode("analysis")
        self.shot("small-dark")
        sizes = self.page.evaluate("""() => ({
            viewport: innerWidth, width: document.documentElement.scrollWidth,
            overflowing: Array.from(document.body.querySelectorAll("*"))
                .filter(e=>!e.closest(".heatwrap, .scrolltable") && e.getBoundingClientRect().right>innerWidth+1)
                .map(e=>[e.tagName,e.id,e.getAttribute("class"),Math.round(e.getBoundingClientRect().right)]).slice(0,20)
        })""")
        self.assertLessEqual(sizes["width"], sizes["viewport"]+1, sizes)
        self.assertGreater(self.page.locator(".heatwrap").evaluate("e => e.scrollWidth-e.clientWidth"),0)

    def test_standalone_downloaded_file(self):
        self.page.goto((ROOT/"index.html").as_uri())
        self.assertIn("$414",self.page.locator(".resultcard").inner_text())
        self.mode("analysis");self.assertTrue(self.page.locator("svg.linechart").is_visible())

    def test_printed_example(self):
        self.page.emulate_media(media="print")
        self.page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        self.assertTrue(self.page.locator(".paperpage").first.is_visible())
        self.assertFalse(self.page.locator("#workspace").is_visible())
        self.assertEqual(self.page.locator(".paperpage").count(),5)
        self.assertIn("No existing or proposed calendar", self.page.locator("#printout").text_content())
        folder=os.environ.get("GA_QA_OUTPUT")
        if TARGET=="chromium" and folder:
            Path(folder).mkdir(parents=True,exist_ok=True)
            self.page.pdf(path=Path(folder)/"sample-report.pdf",prefer_css_page_size=True,print_background=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
