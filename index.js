const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getPrice } = require('./scraper');
const { 
    saveProduct, getTrackingProducts, updatePrice, updateStatus, 
    setReconfirmPrompted, resetReconfirm, getPendingReconfirms 
} = require('./database');

// Catch unhandled errors to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

console.log('Starting WhatsApp Bot initialization...');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true, // Use true or 'new'
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

const userStates = {};

client.on('qr', (qr) => {
    console.log('QR RECEIVED: Please scan the code below:');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN:', percent, message);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED: Session saved successfully!');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE:', msg);
});

client.on('ready', () => {
    console.log('READY: WhatsApp Bot is fully operational!');
    console.log('TEST: Try sending the word "ping" to this number.');
    startTrackingLoop();
});

client.on('message_create', async (msg) => {
    try {
        // IGNORE messages sent by the bot itself to prevent loops
        if (msg.fromMe) {
            // Only process if it's a command you sent to yourself from another device
            // But usually, we want to ignore bot's own automated replies
            if (msg.body.includes('Verifying') || msg.body.includes('Product Found')) return;
        }

        const userId = msg.from;
        const body = msg.body.trim();

        console.log(`MESSAGE RECEIVED from ${userId}: ${body}`);

        // Handle Reconfirmation Prompt
        if (body.toLowerCase() === 'yes' || body.toLowerCase() === 'y') {
            const products = await getPendingReconfirms();
            const myProduct = products.find(p => p.user_id === userId);
            if (myProduct) {
                await resetReconfirm(myProduct.id);
                await client.sendMessage(userId, 'Great! I will continue tracking this product for another 24 hours.');
                return;
            }
        } else if (body.toLowerCase() === 'no' || body.toLowerCase() === 'n') {
            const products = await getPendingReconfirms();
            const myProduct = products.find(p => p.user_id === userId);
            if (myProduct) {
                await updateStatus(myProduct.id, 'completed');
                await client.sendMessage(userId, 'Stopped tracking this product.');
                return;
            }
        }

        // Simple Test Command
        if (body.toLowerCase() === 'ping') {
            await client.sendMessage(userId, 'pong! Bot is alive and working.');
            return;
        }

        if (body.toLowerCase() === 'cancel') {
            delete userStates[userId];
            await client.sendMessage(userId, 'Price tracking request cancelled.');
            return;
        }

        // Detect Links (More robust detection)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = body.match(urlRegex);

        if (urlMatch) {
            const url = urlMatch[0];
            await client.sendMessage(userId, 'Verifying shopping link... please wait. 🔍');
            
            const { price, site, error } = await getPrice(url);
            console.log(`Scrape result for ${site}: Price = ${price}, Error = ${error}`);

            if (site === 'Unsupported') {
                await client.sendMessage(userId, 'Sorry, this website is not supported yet.');
                return;
            }

            if (price) {
                userStates[userId] = {
                    state: 'CONFIRM_PRODUCT',
                    url: url,
                    site: site,
                    initialPrice: price
                };
                await client.sendMessage(userId, `Product Found on ${site}!\nCurrent Price: ₹${price}\n\nWould you like to track this product? (Reply with Yes/No)`);
            } else {
                await client.sendMessage(userId, `Sorry, I couldn't find the price on that page (${site}). Make sure it's a direct product link.`);
            }
            return;
        } 
        // Confirm Product State
        else if (userStates[userId] && userStates[userId].state === 'CONFIRM_PRODUCT') {
            const input = body.toLowerCase();
            if (input === 'yes' || input === 'y' || input === 'a') {
                userStates[userId].state = 'SET_THRESHOLD';
                await client.sendMessage(userId, `How much decrease in price to be alerted on?\na) 5%\nb) 10%\nc) Set any other amount\n\nReply with a, b, or c.`);
            } else {
                delete userStates[userId];
                await client.sendMessage(userId, 'Tracking request cancelled.');
            }
            return;
        }
        // Set Threshold State
        else if (userStates[userId] && userStates[userId].state === 'SET_THRESHOLD') {
            const state = userStates[userId];
            const input = body.toLowerCase();
            let targetPrice = 0;
            let thresholdValue = 0;

            if (input === 'a' || input.includes('5%')) {
                targetPrice = state.initialPrice * 0.95;
                thresholdValue = 5;
            } else if (input === 'b' || input.includes('10%')) {
                targetPrice = state.initialPrice * 0.90;
                thresholdValue = 10;
            } else if (input === 'c' || input.includes('other') || input.includes('amount')) {
                userStates[userId].state = 'CUSTOM_AMOUNT';
                await client.sendMessage(userId, 'Enter target price (e.g. 500):');
                return;
            } else {
                await client.sendMessage(userId, 'Please reply with a, b, or c.');
                return;
            }

            await saveProduct({
                user_id: userId,
                url: state.url,
                site: state.site,
                initial_price: state.initialPrice,
                target_price: targetPrice,
                threshold_type: 'percent',
                threshold_value: thresholdValue
            });
            await client.sendMessage(userId, `Started tracking! Target: ₹${targetPrice.toFixed(2)}`);
            delete userStates[userId];
        }
        else if (userStates[userId] && userStates[userId].state === 'CUSTOM_AMOUNT') {
            const amount = parseFloat(body);
            if (!isNaN(amount)) {
                const state = userStates[userId];
                await saveProduct({
                    user_id: userId, url: state.url, site: state.site,
                    initial_price: state.initialPrice, target_price: amount,
                    threshold_type: 'amount', threshold_value: amount
                });
                await client.sendMessage(userId, `Started tracking! Target: ₹${amount}`);
                delete userStates[userId];
            }
        }
    } catch (e) {
        console.error('Error handling message:', e);
    }
});

async function startTrackingLoop() {
    console.log('TRACKING LOOP: Started background monitoring...');
    while (true) {
        try {
            // 1. Handle Active Tracking
            const products = await getTrackingProducts();
            for (let product of products) {
                // Check if 24 hours have passed since last reconfirm
                const lastReconfirm = new Date(product.last_reconfirm_at);
                const now = new Date();
                const hoursPassed = (now - lastReconfirm) / (1000 * 60 * 60);

                if (hoursPassed >= 24) {
                    await setReconfirmPrompted(product.id);
                    await client.sendMessage(product.user_id, `⏳ 24-hour limit reached for: ${product.site} product.\nWould you like to continue tracking for another 24 hours? (Reply Yes/No)\nNote: Tracking will stop if no response within 1 hour.`);
                    continue;
                }

                const { price } = await getPrice(product.url);
                if (price) {
                    await updatePrice(product.id, price);
                    if (price <= product.target_price) {
                        await client.sendMessage(product.user_id, `🚨 PRICE DROP!\nPrice is now ₹${price}\nTarget was ₹${product.target_price}`);
                        await updateStatus(product.id, 'alerted');
                    }
                }
                // Delay between checks to avoid rate limiting
                await new Promise(r => setTimeout(r, 5000));
            }

            // 2. Handle 1-hour Timeout for Pending Reconfirmations
            const pending = await getPendingReconfirms();
            for (let p of pending) {
                const promptTime = new Date(p.reconfirm_sent_at);
                const now = new Date();
                const minutesPassed = (now - promptTime) / (1000 * 60);

                if (minutesPassed >= 60) {
                    await updateStatus(p.id, 'completed');
                    await client.sendMessage(p.user_id, `🚫 Tracking stopped for ${p.site} product due to no response within 1 hour.`);
                }
            }

        } catch (e) {
            console.error('Error in tracking loop:', e);
        }
        await new Promise(r => setTimeout(r, 60000)); // Check every minute
    }
}

console.log('Initializing WhatsApp Client...');
client.initialize().catch(err => console.error('Initialization Error:', err));
