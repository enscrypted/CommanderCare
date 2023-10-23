const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Define a model
class Employee extends Model {}
Employee.init({
  // Define the model attributes
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  taxed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  isTerminated: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  clockedIn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  sequelize, // Pass the Sequelize instance
  modelName: 'Employee', // Set the model name
  tableName: 'employees', // Set the table name
  timestamps: false
});

module.exports = Employee;