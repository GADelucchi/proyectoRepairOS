require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || 'repairos',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  dialect: 'mysql',
  logging: false
};

module.exports = {
  development: { ...base },
  test: { ...base, database: `${base.database}_test` },
  production: { ...base, dialect: 'mysql', logging: false }
};
