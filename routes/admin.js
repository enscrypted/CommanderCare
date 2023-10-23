var express = require('express');
var router = express.Router();
const bodyParser = require('body-parser');
const User  = require("../models/User.js");
const Shift = require("../models/Shift.js");
const common = require("./lib/common.js");

/* GET users listing. */
router.get('/', async function(req, res, next) {
  if(req.session.isLoggedIn && req.session.permissionLevel === "admin") {
    try {
      const users = await User.findAll();
      let shifts = await Shift.findAll();
      let unpaidHoursByEmployee = null;
      shifts = shifts.filter(shift => !shift.paid 
                                     && shift.shiftDate !== new Date(Date.now()).toLocaleDateString()
                                     && shift.clockIns.split(';').length === shift.clockOuts.split(';').length);
      if(shifts) {
        unpaidHoursByEmployee = shifts.reduce((acc, shift) => {
          let employeeId = shift.employeeId;
          if (!acc[employeeId]) {
            acc[employeeId] = common.calculateUnpaidHours([shift]);
          }
          else {
            acc[employeeId] += common.calculateUnpaidHours([shift]);
          }
          return acc;
        }, {});
      }
      res.render('portal/admin/home', { users, activeUsername: req.session.userName, unpaidHoursByEmployee });
      return;
    }
    catch (error) {
      console.log('Error retrieving users:', error);
      res.status(500).send('Internal Server Error');
      return;
    }
  }
  res.redirect('/portal/');
});

module.exports = router;
