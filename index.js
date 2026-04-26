const { chromium } = require("playwright");

const EMAIL = process.env.CR_EMAIL;
const PASSWORD = process.env.CR_PASSWORD;
let targetDate = process.env.INPUT_DATE;

if (targetDate && targetDate.includes("/")) {
  const parts = targetDate.split("/");
  targetDate = `${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
}
console.log("Booking for:", targetDate);
const BASE_URL = "https://app.courtreserve.com/Online/Reservations/Index/9529";

// config
const DAYS_AHEAD = 7;
const TARGET_DAYS = [1, 2, 4, 5]; // Mon Tue Thu Fri (0=Sun)
const START_TIME = "7:30 AM";
const END_TIME = "8:30 AM";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();









  // ---------------------------
  // LOGIN
  // ---------------------------
await page.goto("https://app.courtreserve.com/Account/Login", {
  waitUntil: "domcontentloaded"
});

// wait explicitly for input to exist
await page.waitForSelector('input[type="email"], input[name="Email"]', { timeout: 60000 });

await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);

await Promise.all([
  page.waitForNavigation(),
  page.click('button[type="submit"]')
]);

await page.waitForLoadState("networkidle");
await page.screenshot({ path: "after-login.png", fullPage: true });

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
    if (!targetDate && !TARGET_DAYS.includes(day)) continue;

    const dateString = date.toISOString().slice(0, 10);
if (targetDate && dateString !== targetDate) {
  continue;
}

    console.log("Checking:", dateString);

    // navigate calendar (adjust selector if needed)
    await page.locator(`button:has-text("${date.getDate()}")`).first().click();

    await page.waitForSelector(`text=${START_TIME}`);

    // ---------------------------
    // CHECK IF ALREADY BOOKED
    // ---------------------------
    const alreadyBooked = await page.locator("text=Reservation").count();

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

// add players (do this once before trying courts)
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
// TRY COURTS (1 → 4)
// ---------------------------
const courts = [
  "Outdoor Court 1",
  "Outdoor Court 2",
  "Outdoor Court 3",
  "Outdoor Court 4"
];

let success = false;

for (const court of courts) {
  try {
    console.log("Trying:", court);

    // open court selector
    await page.click("text=Court(s)");
    await page.waitForTimeout(400);

    // clear previous selections (important)
    const selected = page.locator('.selected, [aria-selected="true"]');
    const count = await selected.count();
    for (let i = 0; i < count; i++) {
      await selected.nth(i).click();
    }

    // select current court
    await page.click(`text=${court}`);

    // try to save
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.click("text=Save");
      await page.waitForTimeout(800);

      if (await page.locator("text=Reservation Confirmed").count()) {
        console.log("✅ Booked on", court);
        success = true;
        break;
      }
    }

    if (success) break;

  } catch (err) {
    console.log("❌ Failed on", court);
  }
}


    // ---------------------------
    // FINAL RESULT
    // ---------------------------
    if (!success) {
      console.log("❌ Failed:", dateString);
    }
  } // ✅ END OF FOR LOOP

  // 🔥 CLOSE BROWSER HERE (outside loop)
  await browser.close();
})();