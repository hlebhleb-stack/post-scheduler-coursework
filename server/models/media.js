import { DataTypes, Sequelize } from 'sequelize';

// ORM-модель описывает файл; медиатека выбирает записи без post_id.
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  pool: { max: 3, min: 0, acquire: 6000 },
});
export const Media = sequelize.define(
  'Media',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    mime: { type: DataTypes.TEXT, allowNull: false },
    kind: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.BLOB, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'attachments', timestamps: false },
);
