import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function run() {
  const homepageUrl = 'https://tixcraft.com';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  console.log('1. Launching Playwright to get cookies and extract an active event URL...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  let cookieString = '';
  let targetGameUrl = '';

  try {
    const context = await browser.newContext({
      locale: 'zh-TW',
      userAgent: userAgent,
    });
    
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    console.log(`Navigating to homepage: ${homepageUrl}`);
    const response = await page.goto(homepageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log(`Playwright Homepage Status: ${response?.status()}`);
    console.log(`Playwright Homepage Title: "${await page.title()}"`);

    // Extract links
    const hrefs = await page.locator('a').evaluateAll((links) => 
      links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => href.includes('/activity/detail/') || href.includes('/activity/game/'))
    );
    
    const uniqueHrefs = Array.from(new Set(hrefs));
    console.log(`Found ${uniqueHrefs.length} event links.`);
    
    if (uniqueHrefs.length > 0) {
      let firstUrl = uniqueHrefs[0];
      if (firstUrl.includes('/activity/detail/')) {
        targetGameUrl = firstUrl.replace('/activity/detail/', '/activity/game/');
      } else {
        targetGameUrl = firstUrl;
      }
      console.log(`Targeting active game URL: ${targetGameUrl}`);
    } else {
      console.log('No event links found on homepage. Using fallback.');
      targetGameUrl = 'https://tixcraft.com/activity/game/24_gpmanila';
    }

    // Get cookies
    const cookies = await context.cookies();
    console.log(`Retrieved ${cookies.length} cookies from Playwright context.`);
    cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (error: any) {
    console.error('Error during Playwright execution:', error.message);
  } finally {
    await browser.close();
  }

  if (!cookieString) {
    console.error('No cookies retrieved. Aborting fetch test.');
    return;
  }

  console.log('\n2. Testing raw HTTP fetch reusing the cookies for the active game URL...');
  const headers = {
    'User-Agent': userAgent,
    'Cookie': cookieString,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  };

  try {
    console.log(`Fetching: ${targetGameUrl}`);
    const fetchResponse = await fetch(targetGameUrl, {
      method: 'GET',
      headers: headers,
    });

    console.log(`Fetch Response Status: ${fetchResponse.status} ${fetchResponse.statusText}`);
    const text = await fetchResponse.text();
    
    const isCloudflareBlocked = fetchResponse.status === 403 || 
                                text.includes('Attention Required') || 
                                text.includes('Cloudflare') || 
                                text.includes('Just a moment');

    console.log(`Blocked by WAF/Bot Protection? ${isCloudflareBlocked ? 'YES ❌' : 'NO  (Success!)'}`);
    
    if (!isCloudflareBlocked && fetchResponse.status === 200) {
      fs.writeFileSync('d:\\code\\ticket-monitor\\scratch\\game-page.html', text);
      console.log('Saved raw HTML to d:\\code\\ticket-monitor\\scratch\\game-page.html');

      const $ = cheerio.load(text);
      const title = $('title').text().trim();
      console.log(`Parsed Page Title: "${title}"`);
      
      const h1 = $('h1').text().trim();
      if (h1) console.log(`Parsed H1 (Event Name): "${h1}"`);
      
      // Let's check table and print content
      const rows = $('table tr');
      console.log(`Parsed table rows count: ${rows.length}`);
      if (rows.length > 0) {
        rows.each((i, el) => {
          const cells = $(el).find('td, th').map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
          console.log(`Row ${i}:`, cells);
        });
      } else {
        console.log('No table rows found! Checking if a table tag exists:');
        console.log('Table elements found count:', $('table').length);
      }
    } else {
      console.log('Body snippet (first 1000 chars):', text.trim().slice(0, 1000).replace(/\s+/g, ' '));
    }
  } catch (error: any) {
    console.error('Error during raw fetch:', error.message);
  }
}

run().catch(console.error);
