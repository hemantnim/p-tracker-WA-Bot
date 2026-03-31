const puppeteer = require('puppeteer');

const supportedDomains = ['amazon.in', 'amazon.com', 'flipkart.com', 'myntra.com', 'ajio.com', 'meesho.com'];

async function getPrice(url) {
    const isSupported = supportedDomains.some(domain => url.toLowerCase().includes(domain));
    if (!isSupported) {
        return { price: null, site: 'Unsupported', error: 'Domain not supported' };
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Increase timeout for slow e-commerce sites
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        let price = null;
        let site = '';

        if (url.includes('amazon')) {
            site = 'Amazon';
            price = await page.evaluate(() => {
                const selectors = ['.a-price-whole', '#priceblock_ourprice', '#priceblock_dealprice', '.a-offscreen'];
                for (let s of selectors) {
                    const el = document.querySelector(s);
                    if (el && el.innerText) {
                        const val = parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                        if (val) return val;
                    }
                }
                return null;
            });
        } else if (url.includes('flipkart')) {
            site = 'Flipkart';
            price = await page.evaluate(() => {
                const selectors = ['._30jeq3._16Jk6d', '._30jeq3', '.nxm97w', '.y_Y96A'];
                for (let s of selectors) {
                    const el = document.querySelector(s);
                    if (el && el.innerText) {
                        const val = parseFloat(el.innerText.replace(/[^\d.]/g, '').replace(/,/g, ''));
                        if (val) return val;
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
