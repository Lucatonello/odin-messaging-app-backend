const { Pool } = require("pg");

console.log('database url: ', process.env.DATABASE_URL);
module.exports = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
