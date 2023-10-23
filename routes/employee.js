var express = require('express');
var router = express.Router();
const bodyParser = require('body-parser');
const User  = require("../models/User.js");
const Employee  = require("../models/Employee.js");
const Shift = require("../models/Shift.js");
const common = require('./lib/common');
const e = require('express');

/* GET users listing. */
router.get('/', async function(req, res, next) {
  if(req.session.isLoggedIn && req.session.permissionLevel === "Employee") {
      let user = await User.findAll({
        where: {
          username: req.session.userName
        }
      });
      user = user[0];
      res.render('portal/employee/home', { u: user });
      return;
  }
  res.redirect('/portal/');
});

router.get('/shifts', function(req, res, next) {
  if(req.session.isLoggedIn && req.session.permissionLevel === "Employee") {
    User.findOne({
      where: {
        username: req.session.userName
      }
    })
    .then(user => {
      if(user) {
        Employee.findByPk(user.id).then(employee => {
          if(employee) {
            Shift.findAll({
              where: {
                employeeId: employee.id,
                paid: false
              }
            }).then(shifts => {
              let unpaidHours = 0;
              if(shifts && shifts.length > 0) {
                shifts = shifts.filter(shift => shift.shiftDate !== new Date(Date.now()).toLocaleDateString()
                                                && shift.clockIns 
                                                && shift.clockOuts 
                                                && shift.clockIns.split(';').length == shift.clockOuts.split(';').length);
                if(shifts) {
                  unpaidHours = common.calculateUnpaidHours(shifts);
                }
              }
              res.render('portal/employee/shifts', { e: employee, unpaidHours: unpaidHours });
              return;
            });
          }
          else {
            res.redirect('/portal/');
            return;
          }
        });
      }
    });
  }
  else {
    res.redirect('/portal/');
  }
});

module.exports = router;