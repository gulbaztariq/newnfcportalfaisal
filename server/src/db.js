const { Sequelize } = require('sequelize');
const { db, isProd } = require('./config');

const common = { logging: false, define: { underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' } };

const sequelize = db.dialect === 'sqlite'
  ? new Sequelize({ dialect: 'sqlite', storage: db.storage || ':memory:', ...common })
  : new Sequelize(db.name, db.user, db.password, {
      host: db.host,
      port: db.port,
      dialect: db.dialect,
      pool: { max: 10, min: 0, idle: 10000 },
      dialectOptions: { charset: 'utf8mb4' },
      ...common,
      define: { ...common.define, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
      logging: isProd ? false : false,
    });

module.exports = sequelize;
