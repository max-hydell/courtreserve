const { chromium } = require("playwright");

const EMAIL = process.env.CR_EMAIL;
const PASSWORD = process.env.CR_PASSWORD;

const BASE_URL = "https://app.courtreserve.com/Online/Reservations/Index/9529";

// config
const DAYS_AHEAD = 7;
const TARGET_DAYS = [1, 2, 4, 5]; // Mon Tue Thu Fri (0=Sun)
const START_TIME = "7:30 AM";
const END_TIME = "8:30 AM";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ---------------------------
  // LOGIN
  // ---------------------------
  await page.goto("https://app.courtreserve.com/Account/Login");

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState("networkidle");

  console.log("✅ Logged in");

  // ---------------------------
  // GO TO RESERVATIONS PAGE
  // ---------------------------
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");

  // ---------------------------
  // LOOP DAYS
  // ---------------------------
  const today = new Date();

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = new Date();
    date.setDate(today.getDate() + i);

    const day = date.getDay();
    if (!TARGET_DAYS.includes(day)) continue;

    const dateString = date.toLocaleDateString("en-US");

    console.log("Checking:", dateString);

    // navigate calendar (adjust selector if needed)
    await page.click(`text=${date.getDate()}`);

    await page.waitForTimeout(1000);

    // ---------------------------
    // CHECK IF ALREADY BOOKED
    // ---------------------------
    const alreadyBooked = await page.locator("text=7:30 AM").count();

    if (alreadyBooked > 0) {
      console.log("⏭️ Already booked:", dateString);
      continue;
    }

    // ---------------------------
    // CLICK TIME SLOT
    // ---------------------------
    const slot = page.locator(`text=${START_TIME}`).first();
    await slot.click();

    // ---------------------------
    // FILL FORM
    // ---------------------------
    await page.waitForSelector("text=Create Reservation");

    // reservation type
    await page.selectOption('select', { label: "Singles" });

    // duration
    await page.selectOption('select', { label: "1 hour" });

    // select court (Outdoor Court 1)
    await page.click("text=Court(s)");
    await page.click("text=Outdoor Court 1");

    // add players
    await page.fill('input[placeholder*="Search for other player"]', "Matt Williamson");
    await page.click("text=Matt Williamson");

    await page.fill('input[placeholder*="Search for other player"]', "Shayne Wright");
    await page.click("text=Shayne Wright");

    // agree checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    // ---------------------------
    // SUBMIT (WITH RETRIES)
    // ---------------------------
    let success = false;

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await page.click("text=Save");
        await page.waitForTimeout(1000);

        if (await page.locator("text=Reservation Confirmed").count()) {
          console.log("✅ Booked:", dateString);
          success = true;
          break;
        }
      } catch {}

      await page.waitForTimeout(300);
    }

    if (!success) {
      console.log("❌ Failed:", dateString);
    }
  }

  await browser.close();
})();