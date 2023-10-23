const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Define a model
class Mfa extends Model {}
Mfa.init({
  // Define the model attributes
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  emailCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  codeExpiration: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  appEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  appSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rememberedTokens: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  timeWindowUsed: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  }
}, {
  sequelize, // Pass the Sequelize instance
  modelName: 'Mfa', // Set the model name
  tableName: 'mfa', // Set the table name
  timestamps: false
});

module.exports = Mfa;