import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outputDir = 'd:\\code\\ticket-monitor\\scratch\\screenshots_tixcraft_all';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const targetUrl = 'https://tixcraft.com';

async function testMode(name: string, filename: string, launchOptions: any, contextOptions: any = {}) {
  console.log(`\n=================== Testing Tixcraft: ${name} ===================`);
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      locale: 'zh-TW',
      viewport: { width: 1280, height: 900 },
      ...contextOptions
    });
    
    // Optional: inject stealth scripts
    if (contextOptions.injectStealth) {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-TW', 'zh', 'en-US', 'en'] });
      });
    }

    const page = await context.newPage();
    console.log(`Navigating to: ${targetUrl} (waiting for domcontentloaded)...`);
    const response = await page.goto(targetUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    console.log(`Response Status: ${response?.status()}`);
    console.log(`Initial Page Title: "${await page.title()}"`);
    
    // Wait 5 seconds to let any JS load or Turnstile challenge settle
    await page.waitForTimeout(5000);
    
    const finalTitle = await page.title();
    console.log(`Final Page Title: "${finalTitle}"`);
    
    // Save screenshot
    const screenshotPath = path.join(outputDir, `${filename}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    const bodyText = await page.locator('body').innerText();
    const isBlocked = bodyText.includes('Attention Required') || 
                      bodyText.includes('Cloudflare') || 
                      bodyText.includes('Just a moment') ||
                      bodyText.includes('Your Browsing Activity Has Been Paused') ||
                      bodyText.includes("Let's Get Your Identity Verified") ||
                      finalTitle.includes('Cloudflare') ||
                      finalTitle.includes('Just a moment') ||
                      response?.status() === 403;
    
    console.log(`WAF / Bot challenge detected? ${isBlocked ? 'YES ❌' : 'NO  (Success!)'}`);
    console.log('Body snippet (first 150 chars):', bodyText.trim().slice(0, 150).replace(/\s+/g, ' '));
  } catch (error: any) {
    console.error(`Error in ${name}:`, error.message);
  } finally {
    await browser.close();
  }
}

async function runAll() {
  // Test 1: Normal Non-Headless
  await testMode('1. Normal Non-Headless', '1_non_headless', {
    headless: false,
  });

  // Test 2: Standard Headless
  await testMode('2. Standard Headless', '2_standard_headless', {
    headless: true,
  });

  // Test 3: Headless with Custom User-Agent
  await testMode('3. Headless + Custom User-Agent', '3_headless_ua', {
    headless: true,
  }, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Test 4: Headless + Custom User-Agent + Disable AutomationControlled Flag
  await testMode('4. Headless + Custom UA + Automation Bypass Flag', '4_headless_ua_flag', {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  }, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Test 5: Headless + Custom UA + Automation Bypass + webdriver JS override (Stealth)
  await testMode('5. Headless + Custom UA + Automation Bypass + webdriver JS override', '5_headless_stealth', {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  }, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    injectStealth: true
  });
}

runAll().catch(console.error);
