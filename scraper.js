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
        
        // Increase timeout and wait for network idle to ensure price loads
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

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
                const selectors = [
                    '._30jeq3._16Jk6d', // Desktop price
                    '._30jeq3',         // Common price
                    '.nxm97w',          // Mobile price
                    '.y_Y96A',          // Alternative price
                    '[class*="price-value"]',
                    '.web-price',
                    'div[class*="_30jeq3"]'
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
