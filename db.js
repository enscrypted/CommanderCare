var mysql = require('mysql');
const { Sequelize, Model, DataTypes } = require('sequelize');

var con = mysql.createPool(process.env.JAWSDB_URL);

// Create a Sequelize instance
const sequelize = new Sequelize(process.env.JAWSDB_URL);

// Test the connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

// Synchronize the model with the database
sequelize.sync();

// Call the testConnection function
testConnection();

module.exports = {
  con,
  sequelize
}