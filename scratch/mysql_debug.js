require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
    try {
        console.log("=== Querying chapters in MySQL ===");
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'graphci'
        });

        const [chaptersCount] = await connection.execute("SELECT COUNT(*) as count FROM chapters");
        console.log("Total chapters in MySQL:", chaptersCount[0].count);

        if (chaptersCount[0].count > 0) {
            const [chapters] = await connection.execute("SELECT id, name, level FROM chapters LIMIT 20");
            console.log("Chapters:", chapters);
        }

        await connection.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
