const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'tracker.db');
const db = new Database(dbPath);

// Table for products being tracked
db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    url TEXT,
    site TEXT,
    initial_price REAL,
    current_price REAL,
    target_price REAL,
    threshold_type TEXT,
    threshold_value REAL,
    status TEXT DEFAULT 'tracking',
    last_checked DATETIME,
    last_reconfirm_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconfirm_sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Table for price history
db.exec(`CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    price REAL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
)`);

module.exports = {
    db,
    saveProduct: (product) => {
        return new Promise((resolve, reject) => {
            try {
                const { user_id, url, site, initial_price, target_price, threshold_type, threshold_value } = product;
                const stmt = db.prepare(`INSERT INTO products (user_id, url, site, initial_price, current_price, target_price, threshold_type, threshold_value) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                const info = stmt.run(user_id, url, site, initial_price, initial_price, target_price, threshold_type, threshold_value);
                resolve(info.lastInsertRowid);
            } catch (err) {
                reject(err);
            }
        });
    },
    getTrackingProducts: () => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM products WHERE status = 'tracking'`).all();
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },
    updatePrice: (id, price) => {
        return new Promise((resolve, reject) => {
            try {
                db.prepare(`UPDATE products SET current_price = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?`).run(price, id);
                db.prepare(`INSERT INTO price_history (product_id, price) VALUES (?, ?)`).run(id, price);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    },
    updateStatus: (id, status) => {
        return new Promise((resolve, reject) => {
            try {
                db.prepare(`UPDATE products SET status = ? WHERE id = ?`).run(status, id);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    },
    setReconfirmPrompted: (id) => {
        return new Promise((resolve, reject) => {
            try {
                db.prepare(`UPDATE products SET status = 'pending_reconfirm', reconfirm_sent_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    },
    resetReconfirm: (id) => {
        return new Promise((resolve, reject) => {
            try {
                db.prepare(`UPDATE products SET status = 'tracking', last_reconfirm_at = CURRENT_TIMESTAMP, reconfirm_sent_at = NULL WHERE id = ?`).run(id);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    },
    getPendingReconfirms: () => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM products WHERE status = 'pending_reconfirm'`).all();
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }
};
