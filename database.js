const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'tracker.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Table for products being tracked
    db.run(`CREATE TABLE IF NOT EXISTS products (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Table for price history
    db.run(`CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        price REAL,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);
});

module.exports = {
    db,
    saveProduct: (product) => {
        return new Promise((resolve, reject) => {
            const { user_id, url, site, initial_price, target_price, threshold_type, threshold_value } = product;
            db.run(`INSERT INTO products (user_id, url, site, initial_price, current_price, target_price, threshold_type, threshold_value) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [user_id, url, site, initial_price, initial_price, target_price, threshold_type, threshold_value],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
        });
    },
    getTrackingProducts: () => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM products WHERE status = 'tracking'`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    updatePrice: (id, price) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE products SET current_price = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?`, 
                [price, id], (err) => {
                if (err) reject(err);
                else {
                    db.run(`INSERT INTO price_history (product_id, price) VALUES (?, ?)`, [id, price], (err2) => {
                        if (err2) reject(err2);
                        else resolve();
                    });
                }
            });
        });
    },
    updateStatus: (id, status) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE products SET status = ? WHERE id = ?`, [status, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
};
