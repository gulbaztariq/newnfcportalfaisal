const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env;

// Railway: public domain + MySQL plugin variables (MYSQL_URL / MYSQLHOST ...) are picked up automatically
const railwayUrl = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : null;
const dbUrl = env.DATABASE_URL || env.MYSQL_URL ? new URL(env.DATABASE_URL || env.MYSQL_URL) : null;

module.exports = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 5000),
  appUrl: (env.APP_URL || railwayUrl || 'http://localhost:5000').replace(/\/$/, ''),
  clientUrl: (env.CLIENT_URL || env.APP_URL || railwayUrl || 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: env.JWT_SECRET || 'dev-secret',
  impersonateSecret: env.IMPERSONATE_SECRET || 'dev-impersonate-secret',
  db: {
    dialect: env.DB_DIALECT || 'mysql',
    host: env.DB_HOST || dbUrl?.hostname || env.MYSQLHOST || '127.0.0.1',
    port: Number(env.DB_PORT || dbUrl?.port || env.MYSQLPORT || 3306),
    name: env.DB_NAME || dbUrl?.pathname.slice(1) || env.MYSQLDATABASE || 'nfc_vcards',
    user: env.DB_USER || (dbUrl && decodeURIComponent(dbUrl.username)) || env.MYSQLUSER || 'root',
    password: env.DB_PASSWORD || (dbUrl && decodeURIComponent(dbUrl.password)) || env.MYSQLPASSWORD || '',
    storage: env.DB_STORAGE ? path.resolve(__dirname, '..', env.DB_STORAGE) : undefined,
  },
  mail: {
    host: env.MAIL_HOST,
    port: Number(env.MAIL_PORT || 587),
    secure: env.MAIL_SECURE === 'true',
    user: env.MAIL_USER,
    password: env.MAIL_PASSWORD,
    from: env.MAIL_FROM || 'NFC Profile <no-reply@example.com>',
  },
  // on Railway point UPLOAD_DIR at a mounted volume so uploads survive redeploys
  uploadDir: env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : path.join(__dirname, '..', 'uploads'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
  publicDir: path.join(__dirname, '..', '..', 'client', 'public'),
  seed: {
    email: env.SUPER_ADMIN_EMAIL || 'sadmin@vcard.com',
    password: env.SUPER_ADMIN_PASSWORD || '123456',
  },
};
