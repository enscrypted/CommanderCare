const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Define a model
class User extends Model {}
User.init({
  // Define the model attributes
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  primaryPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  secondaryPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  zip: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  sequelize, // Pass the Sequelize instance
  modelName: 'User', // Set the model name
  tableName: 'users', // Set the table name
  timestamps: false
});

module.exports = User;