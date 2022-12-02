var mysql = require('mysql');

var con = mysql.createConnection(process.env.JAWSDB_URL);

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

module.exports = con;