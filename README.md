# P.Tracker - WhatsApp Price Tracking Bot

A Node.js bot that tracks product prices from Amazon, Flipkart, and Myntra and alerts you via WhatsApp when the price drops below your set threshold.

## Features
- **Real-time Link Verification:** Checks product availability and current price.
- **Custom Alert Thresholds:** Choose 5%, 10%, or set a specific price.
- **Smart Tracking:** Randomized checks (2-15 mins) to avoid bot detection.
- **Interactive Alerts:** Notifies you on price drops and asks if you want to continue tracking.
- **23-Hour Idle Alert:** Asks if you want to continue tracking if no price change occurs within 23 hours.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18 or higher)
- WhatsApp on your phone

### 2. Installation
1. Navigate to the project folder:
   ```bash
   cd P.Tracker
   ```
2. The dependencies are already installed. If needed, run:
   ```bash
   npm install
   ```

### 3. Running the Bot
1. Start the bot:
   ```bash
   node index.js
   ```
2. A QR code will appear in your terminal.
3. Open WhatsApp on your phone -> **Linked Devices** -> **Link a Device**.
4. Scan the QR code.
5. Once the terminal says `WhatsApp Bot is ready!`, you can start sending product links to your own number (or the number running the bot).

## Server Hosting Instructions
To keep the bot running 24/7, it is recommended to host it on a VPS (like AWS EC2, DigitalOcean, or Heroku).

1. **Setup PM2:**
   Install PM2 globally to keep the process alive:
   ```bash
   npm install -g pm2
   ```
2. **Start with PM2:**
   ```bash
   pm2 start index.js --name p-tracker
   ```
3. **Monitor Logs:**
   ```bash
   pm2 logs p-tracker
   ```

## Anti-Bot Measures
The bot uses rotating User-Agents and randomized check intervals to mimic human behavior. However, e-commerce sites frequently update their structures. If scraping fails, the selectors in `scraper.js` may need updating.
