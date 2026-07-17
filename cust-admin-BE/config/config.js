require('dotenv').config();

const useSSL = process.env.DB_SSL === 'true';

const dialectOptions = useSSL
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const base = {
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'yunshang_dev',
  dialect: 'postgres',
  logging: false,
  dialectOptions
};

module.exports = {
  development: base,
  staging: base,
  production: base
};
