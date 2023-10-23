const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Define a model
class Shift extends Model {}
Shift.init({
  // Define the model attributes
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  shiftDate: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  weekDay: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  paid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  clockIns: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clockOuts: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize, // Pass the Sequelize instance
  modelName: 'Shift', // Set the model name
  tableName: 'shifts', // Set the table name
  timestamps: false
});

module.exports = Shift;