const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { apiKeys, requestLogs } = require('./schema');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'local.db');
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema: { apiKeys, requestLogs } });

module.exports = { db, apiKeys, requestLogs };
