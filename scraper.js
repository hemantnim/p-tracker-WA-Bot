const puppeteer = require('puppeteer');

const supportedDomains = [
    'amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'amzn.eu', 'a.co',
    'flipkart.com', 'fkrt.it', 'flipkart.page.link', 'dl.flipkart.com',
    'myntra.com', 'ajio.com', 'meesho.com'
];

async function getPrice(url) {
    const lowerUrl = url.toLowerCase();
    const isSupported = supportedDomains.some(domain => lowerUrl.includes(domain));
    
    if (!isSupported) {
        return { price: null, site: 'Unsupported', error: 'Domain not supported' };
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });
        const page = await browser.newPage();
        
        // Set a more modern and common User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Add extra headers to look more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        });

        // Increase timeout and wait for network idle to ensure price loads
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait a bit more for dynamic content
        await new Promise(r => setTimeout(r, 5000));

        // Get the final URL after redirects
        const finalUrl = page.url().toLowerCase();
        let price = null;
        let site = '';

        if (finalUrl.includes('amazon') || finalUrl.includes('amzn')) {
            site = 'Amazon';
            price = await page.evaluate(() => {
                const selectors = [
                    '.a-price-whole', 
                    '.a-price .a-offscreen',
                    '#priceblock_ourprice', 
                    '#priceblock_dealprice', 
                    '#corePrice_feature_div .a-offscreen',
                    '#kindle-price',
                    '.apexPriceToPay .a-offscreen',
                    '#price_inside_buybox',
                    '.priceToPay'
                ];
                for (let s of selectors) {
                    const elements = document.querySelectorAll(s);
                    for (let el of elements) {
                        const text = el.innerText || el.textContent;
                        if (text) {
                            const val = parseFloat(text.replace(/[^\d.]/g, '').replace(/,/g, ''));
                            if (val && val > 0) return val;
                        }
                    }
                }
                return null;
            });
        } else if (finalUrl.includes('flipkart') || finalUrl.includes('fkrt')) {
            site = 'Flipkart';
            price = await page.evaluate(() => {
                // 1. Try common selectors
                const selectors = [
                    '._30jeq3._16Jk6d', 
                    '._30jeq3', 
                    '.nxm97w', 
                    '.y_Y96A',
                    'div[class*="price-value"]',
                    'div[class*="Nx9Wp0"]',
                    'div[class*="_16Jk6d"]'
                ];
                for (let s of selectors) {
                    const el = document.querySelector(s);
                    if (el && el.innerText) {
                        const val = parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                        if (val && val > 0) return val;
                    }
                }

                // 2. Check Meta Tags (Often very reliable)
                const metaPrice = document.querySelector('meta[itemprop="price"]') || 
                                  document.querySelector('meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.content) {
                    const val = parseFloat(metaPrice.content.replace(/[^\d.]/g, ''));
                    if (val && val > 0) return val;
                }

                // 3. Check JSON-LD
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (let script of scripts) {
                    try {
                        const data = JSON.parse(script.innerText);
                        if (data.offers && data.offers.price) return parseFloat(data.offers.price);
                        if (Array.isArray(data) && data[0].offers && data[0].offers.price) return parseFloat(data[0].offers.price);
                    } catch (e) {}
                }

                // 4. Aggressive Fallback: Search for ₹ symbol
                const allSpans = Array.from(document.querySelectorAll('span, div, h1, h2'));
                for (let el of allSpans) {
                    const text = el.innerText;
                    if (text && text.startsWith('₹') && text.length < 15) {
                        const val = parseFloat(text.replace(/[^\d.]/g, ''));
                        if (val && val > 10) return val;
                    }
                }
                return null;
            });
        } else if (url.includes('myntra')) {
            site = 'Myntra';
            price = await page.evaluate(() => {
                const el = document.querySelector('.pdp-price strong') || document.querySelector('.pdp-discount');
                if (el && el.innerText) {
                    return parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                }
                return null;
            });
        } else if (url.includes('ajio')) {
            site = 'Ajio';
            price = await page.evaluate(() => {
                const el = document.querySelector('.pdp-price') || document.querySelector('.pdp-discount');
                if (el && el.innerText) {
                    return parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                }
                return null;
            });
        } else if (url.includes('meesho')) {
            site = 'Meesho';
            price = await page.evaluate(() => {
                // Meesho often uses these classes for price
                const selectors = ['h4', '.szvpsG', '[class*="PriceDisplay"]'];
                for (let s of selectors) {
                    const el = document.querySelector(s);
                    if (el && el.innerText && el.innerText.includes('₹')) {
                        const val = parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                        if (val) return val;
                    }
                }
                return null;
            });
        }

        await browser.close();
        return { price, site };
    } catch (error) {
        if (browser) await browser.close();
        console.error(`Scraping error for ${url}:`, error.message);
        return { price: null, site: 'Unknown', error: error.message };
    }
}

module.exports = { getPrice };
