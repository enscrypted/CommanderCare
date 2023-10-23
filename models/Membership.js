const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Define a model
class Membership extends Model {}
Membership.init({
  // Define the model attributes
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salt: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  lastLoginDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  changePassword: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  sequelize, // Pass the Sequelize instance
  modelName: 'Membership', // Set the model name
  tableName: 'memberships', // Set the table name
  timestamps: false
});

module.exports = Membership;