import { DataTypes, Sequelize } from 'sequelize';

// API module uses the ORM. The worker uses explicit SQL row locking to claim due posts.
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  pool: { max: 3, min: 0, acquire: 6000 },
});
export const Template = sequelize.define('Template', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.TEXT, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'templates', timestamps: false });
