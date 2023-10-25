var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
var http = require('http');
const User  = require("./models/User.js");
const Membership  = require("./models/Membership.js");
const Employee  = require("./models/Employee.js");
const Mfa = require("./models/Mfa.js");
const Shift = require("./models/Shift.js");
const bcrypt = require('bcrypt');
const common = require('./routes/lib/common');

const db = require("./db.js").con;

const session = require("express-session");
const filestore = require("session-file-store")(session);

const crypto = require('crypto');
const base32 = require('hi-base32');
const qrcode = require('qrcode');
const moment = require('moment');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');


var transporter = nodemailer.createTransport(smtpTransport({
  service: process.env.SMTP_SERVICE,
  host: process.env.SMTP,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}));

var indexRouter = require('./routes/index');
var customerRouter = require('./routes/customer');
var adminRouter = require('./routes/admin');
var portalRouter = require('./routes/portal');
var employeeRouter = require('./routes/employee');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// port setup
app.set('port', process.env.PORT || 3000);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  name: "session-id",
  secret: process.env.SESSION_SECRET, // Secret key,
  saveUninitialized: false,
  resave: false,
  store: new filestore() // sessions file store
}));

app.use(function(req, res, next) {
  res.locals.userName = req.session.userName;
  //res.lcoals.userImg = req.session.userImg; (later implementation)
  next();
});

app.use('/', indexRouter);
app.use('/portal/customer/', customerRouter);
app.use('/portal/', portalRouter);
app.use('/portal/admin/', adminRouter);
app.use('/portal/employee/', employeeRouter);

app.post('/', (req, res) => {
  if(!req.body.type) {
    res.status(500).send(null);
    return;
  }

  let type = req.body.type;

  // DB CALL AND QUERY

  let query = 'Select * From 5me where type=?';

  db.query(query, type, function (error, results) {
    if(error || results.length === 0) {
      res.status(500).send(null);
      return;
    }
   
    results = Object.values(results[0]);
    results.shift();

    res.send({'elements': results});
  });
});

app.post('/portal/authenticate/email', function(req, res, next) {
  var code = crypto.randomInt(100000, 999999).toString().padStart(6, '0');
  var expiration = moment(new Date(Date.now())).add(15, 'm').toDate().toISOString().slice(0, 19).replace('T', ' ');
  let query = "Select * From users Where username=?";
  db.query(query, [req.body.username], function(error, results) {
    if(error || results.length === 0) {
      console.log(error);
      res.status(500).send(null);
    }
    let userEmail = results[0].email;
    let userName = results[0].username;
    let id = results[0].id;
    query = "Update mfa Set emailCode = ?, codeExpiration = ? Where id=?";
    db.query(query, [code, expiration, id], function(error, results) {
      if(error || results.length === 0) {
        console.log(error);
        res.status(500).send(null);
      }
      sendMfaEmail(userEmail, process.env.SECURITY_EMAIL, userName, code, res)
    });
  });
});

app.post('/portal/authenticate/appsecret', function(req, res, next) {
  if(!req.session.isLoggedIn) {
    res.status(500).send(null);
  }
  let appSecret = base32.encode(crypto.randomUUID());
  const otpauth = authenticator.keyuri(req.session.userName, 'Commander Care', appSecret);
  qrcode.toDataURL(otpauth, (err, imageUrl) => {
    if (err) {
      console.log('Error with QR');
      res.status(500).send(null);
    }
    res.status(200).send({url: imageUrl, secret: appSecret})
  });
});

app.post('/sendcontactemail', function(req, res, next) {
  let data = req.body;
  sendContactEmail(data.name, data.email, data.number, data.message, res);
});

app.post('/sendestimateemail', function(req, res, next) {
  let data = req.body;
  sendEstimateEmail(data.email, data.category, data.jobType, data.measurement, data.measurementUnit, data.applianceType, JSON.parse(data.modifiers), JSON.parse(data.additionals), data.price, process.env.ADMIN_EMAIL, process.env.COMMANDER_EMAIL, 1, res);
});

app.post('/portal/admin/addUser', function(req, res, next) {
  if(req.session.isLoggedIn && req.session.permissionLevel === "admin") {
    let id = crypto.randomUUID();
    let data = req.body;
    common.checkIfUserExists(data.username).then(exists => {
      if(exists) {
        res.send({success: false, reason: "A user with that username already exists"});
        return;
      }
      data.primaryPhone = formatPhoneNumber(data.primaryPhone);
      if(data.secondaryPhone) {
        data.secondaryPhone = formatPhoneNumber(data.secondaryPhone);
      }
      addUser(data, id).then( () => {
        let tempPassword = common.generateTemporaryPassword(6);
        let role = null;
        if(data.userType === "employee" || data.userType === "contractor") {
          role = "Employee";
        }
        if(data.usertype === "customer") {
          role = "Customer";
        }
        if(role === null) {
          res.send({success: false, reason: "Error Adding User: No User Type Selected"});
          removeUserById(id);
          return;
        }
        addMembership(id, role, tempPassword).then( () => {
          addMfa(id).then( () => {
            if(role === "Customer") {
              NotifyNewUser(id, data.email, data.username, tempPassword, req.get('host'));
              res.send({success: true});
              return;
            }
            addEmployee(id, role).then( () => {
              NotifyNewUser(id, data.email, data.username, tempPassword, req.get('host'));
              res.send({success: true});
              return;
            }).catch( (err) => {
              console.log("Error adding employee: " + err);
              removeMfaById(id);
              removeMembershipById(id);
              removeUserById(id);
              res.send({success: false, reason: "Unable to add Employee to Database"});
              return;
            })
          }).catch( (err) => {
            console.log("Error adding mfa: " + err);
            removeMembershipById(id);
            removeUserById(id);
            res.send({success: false, reason: "Unable to add Mfa Settings to Database"});
            return;
          });
        }).catch( (err) => {
          console.log("Error adding membership: " + err);
          removeUserById(id);
          res.send({success: false, reason: "Error Adding User: Can't add Membership to Database"});
          return;
        });
      }).catch((err) => {
        console.log("Error adding user: " + err);
        res.send({success: false, reason: "Error Adding User to Database"});
        return;
      });
    }).catch(error => {
      console.log("Error checking user existence (" + data.username + "): " + error);
      res.send({success: false, reason: "An error occurred while communicating with the database"});
      return;
    });
    return;
  }
  res.send({success: false, reason: "Invalid Permission To Perform This Action"});
});

app.post('/portal/employee/clockIn', function(req, res, next) {
  if(!req.session.isLoggedIn || !req.body.id || req.body.id !== req.session.userId) {
    console.log('Invalid permission level or mismatched/missing id');
    res.status(500).send(null);
    return;
  }
  Employee.findByPk(req.body.id).then(employee => {
    if(employee.clockedIn) {
      console.log('employee ' + req.session.userName + ' already clocked in');
      res.status(500).send(null);
      return;
    }
    employee.clockedIn = true;
    employee.save().then(onfulfilled => {
      Shift.findAll({
        where: {
          employeeId: req.body.id
        }
      }).then(shifts => {
        if(!shifts || shifts.length === 0) {
          const shiftData = {
            id: crypto.randomUUID(),
            shiftDate: new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
            weekDay: new Date(Date.now()).getDay(),
            paid: false,
            employeeId: req.body.id,
            clockIns: new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
            clockOuts: null
          }
          Shift.create(shiftData).then(onfulfilled => {
            console.log(req.session.userName + " clocked in on " + new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                          + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
            res.status(200).send(null);
            return;
          });
        }
        else if(shifts.some(shift => shift.shiftDate == new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }))) {
          let shift = shifts.filter(shift => shift.shiftDate == new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }))[0];
          shift.clockIns = shift.clockIns + ';' + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
          shift.save().then(onfulfilled => {
            console.log(req.session.userName + " clocked in on " + new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                          + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
            res.status(200).send(null);
            return;
          });
        }
        else {
            const shiftData = {
              id: crypto.randomUUID(),
              shiftDate: new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
              weekDay: new Date(Date.now()).getDay(),
              paid: false,
              employeeId: req.body.id,
              clockIns: new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
              clockOuts: null
            }
            Shift.create(shiftData).then(onfulfilled => {
              console.log(req.session.userName + " clocked in on " + new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                            + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
              res.status(200).send(null);
              return;
            });
          }
        });
      });
  });
});
app.post('/portal/employee/clockOut', function(req, res, next) {
  if(!req.session.isLoggedIn || !req.body.id || req.body.id !== req.session.userId) {
    res.status(500).send(null);
    return;
  }
  Employee.findByPk(req.body.id).then(employee => {
    if(!employee.clockedIn) {
      console.log('employee ' + req.session.userName + ' already clocked in');
      res.status(500).send(null);
      return;
    }
    employee.clockedIn = false;
    employee.save().then(onfulfilled => {
      Shift.findAll({
        where: {
          employeeId: req.body.id
        }
      }).then(shifts => {
        if(!shifts || shifts.length === 0) {
          console.log(req.session.userName + " tried to clock out from a nonexistent shift on "
                        + new Date(Date.now()).toLocaleDateString + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
            res.status(500).send();
            return;
        }
        else if(shifts.some(shift => shift.shiftDate == new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }))) {
          let shift = shifts.filter(shift => shift.shiftDate == new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }))[0];
          if(!shift.clockOuts) {
            shift.clockOuts = new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
          }
          else {
            shift.clockOuts = shift.clockOuts + ';' + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
          }
          shift.save().then(onfulfilled => {
            console.log(req.session.userName + " clocked out on " + new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                          + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
            res.status(200).send(null);
            return;
          });
        }
        else {
            console.log(req.session.userName + " tried to clock out from a nonexistent shift on "
                        + new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) + " at " + new Date(Date.now()).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
            res.status(500).send();
            return;
         }
      });
    });
  });
});

app.post('/portal/admin/payEmployee', async function(req, res, next) {
  if(!req.session.isLoggedIn || req.session.permissionLevel !== "admin" || !req.body.id) {
    res.status(500).send(null);
    console.log('Invalid permissions to pay employee');
    return;
  }

  let shifts = await Shift.findAll({
    where: {
      employeeId: req.body.id
    }
  });

  if(!shifts) {
    res.status(500).send(null);
    console.log('No shifts found');
    return;
  }

  shifts = shifts.filter(shift => !shift.paid 
                                 && shift.shiftDate !== new Date(Date.now()).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                                 && shift.clockIns.split(';').length === shift.clockOuts.split(';').length);
  
  console.log('shifts: ' + shifts);
  for(let i = 0; i < shifts.length; ++i) {
    shifts[i].paid = true;
    await shifts[i].save();
  }

  let employee = await User.findByPk(req.body.id);
  console.log(employee.fullName + " paid on " + new Date(Date.now()).toString());
  res.status(200).send();
});

function NotifyNewUser(id, email, username, tempPassword, host) {
  let validation = common.encryptAndEncode(tempPassword);
  let resetToken = crypto.randomUUID();
  common.addResetToken(id, resetToken).then(saved => {
    let resetUrl = common.generateResetUrl(resetToken, validation, host);
    sendNewUserEmail(email, username, tempPassword, resetUrl);
  });
}

async function removeUserById(id) {
  try {
    const affectedRows = await User.destroy({ where: { id } });
    if (affectedRows === 0) {
      console.log('User not found. Id: ' + id);
    } else {
      console.log('User removed successfully. Id: ' + id);
    }
  } catch (error) {
    console.log('Error removing user:', error);
  }
}

async function removeMembershipById(id) {
  try {
    const affectedRows = await Membership.destroy({ where: { id } });
    if (affectedRows === 0) {
      console.log('Membership not found. Id: ' + id);
    } else {
      console.log('Membership removed successfully. Id: ' + id);
    }
  } catch (error) {
    console.log('Error removing membership:', error);
  }
}

async function removeMfaById(id) {
  try {
    const affectedRows = await Mfa.destroy({ where: { id } });
    if (affectedRows === 0) {
      console.log('Mfa not found. Id: ' + id);
    } else {
      console.log('Mfa removed successfully. Id: ' + id);
    }
  } catch (error) {
    console.log('Error removing mfa:', error);
  }
}

function addUser(data, id) {
  const userData = {
    id: id,
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    primaryPhone: data.primaryPhone,
    secondaryPhone: data.secondaryPhone,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip
  }

  return new Promise((resolve, reject) => {
    User.create(userData)
      .then((user) => {
        console.log('New user created:', user);
        resolve();
      })
      .catch((error) => {
        console.log('Error creating user:', error);
        reject();
      });
  });
}

function addMembership(id, role, tempPassword) {
  let salt = generateSalt();
  let hashedPassword = bcrypt.hashSync(tempPassword, salt);

  const membershipData = {
    id: id,
    role: role,
    passwordHash: hashedPassword,
    salt: salt,
    creationDate: new Date(Date.now()),
    lastLoginDate: null,
    changePassword: false,
    resetToken: null
  }

  return new Promise((resolve, reject) => {
    Membership.create(membershipData)
      .then((membership) => {
        console.log('New membership added:', membership);
        resolve();
      })
      .catch((error) => {
        console.log('Error adding membership:', error);
        reject();
      });
  });
}

function addMfa(id) {
  const mfaData = {
    id: id,
    emailCode: null,
    codeExpiration: null,
    appEnabled: false,
    appSecret: null,
    rememberedTokens: null,
    attempts: 0,
    timeWindowUsed: 0
  }

  return new Promise((resolve, reject) => {
    Mfa.create(mfaData)
      .then((mfa) => {
        console.log('New Mfa added:', mfa);
        resolve();
      })
      .catch((error) => {
        console.log('Error adding mfa:', error);
        reject();
      });
  });
}

function addEmployee(id, role) {
  const employeeData = {
    id: id,
    taxed: role === "Employee",
    isTerminated: false
  }

  return new Promise((resolve, reject) => {
    Employee.create(employeeData)
      .then((employee) => {
        console.log('New Employee added:', employee);
        resolve();
      })
      .catch((error) => {
        console.log('Error adding employee:', error);
        reject();
      });
  });
}

function generateSalt() {
  const saltRounds = 10;
  return bcrypt.genSaltSync(saltRounds);
}

function formatPhoneNumber(number) {
  number = number.replace(/\D/g,'');
  number = number.substring(0, 10);
  number = number.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return number;
}

function sendContactEmail(name, email, number, message, res) {
  var mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: process.env.COMMANDER_EMAIL,
    subject: 'Someone Submitted a Contact Form',
    html: buildContactEmail(name, email, number, message)
  }
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.status(500).send(null);
    } else {
      console.log('Email sent: ' + info.response);
      sendContactEmailConfirmation(name, email, res);
    }
  });  
}

function sendContactEmailConfirmation(name, email, res) {
  var mailOptions = {
    from: process.env.COMMANDER_EMAIL,
    to: email,
    subject: 'Thank You For Reaching Out!',
    html: buildContactEmailConfirmation(name),
    attachments: [{filename: 'logo.png',
                  path: common.logoEncoding,
                  cid: 'logo@nodemailer.com' }]
  }
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.status(500).send(null);
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).send({success: true});
    }
  });  
}

function sendMfaEmail(toEmail, fromEmail, username, code, res) {
  var mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: 'Your Commander Care Login Verification Code',
    html: buildMfaEmail(username, code),
    attachments: [{filename: 'logo.png',
                  path: common.logoEncoding,
                  cid: 'logo@nodemailer.com' }]
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.status(500).send(null);
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).send({success: true});
    }
  });  
}

function sendNewUserEmail(email, username, tempPassword, url) {
  var mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: email,
    subject: 'Your Account is Ready',
    html: buildNewUserEmail(username, url),
    attachments: [{filename: 'logo.png',
                  path: common.logoEncoding,
                  cid: 'logo@nodemailer.com' }]
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(`Error sending New User email to ${username}. Temporary password: ${tempPassword}`);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });  
}

function sendEstimateEmail(email, category, jobType, measurement, measurementUnit, applianceType, modifiers, additionals, price, fromEmail, toEmail, loop, res) {
  var mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: loop === 1 
              ? 'A 5 Minute Estimate was Sent to ' + email
              : 'Your 5 Minute Estimate',
    html: buildEstimateEmail(category, jobType, measurement, measurementUnit, applianceType, modifiers, additionals, price),
    attachments: [{filename: 'logo.png',
                  path: common.logoEncoding,
                  cid: 'logo@nodemailer.com' }]
  }
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.status(500).send(null);
    } else {
      console.log('Email sent: ' + info.response);
      if(loop === 1) {
        sendEstimateEmail(email, category, jobType, measurement, measurementUnit, applianceType, modifiers, additionals, price, toEmail, email, ++loop, res);
      }
      else {
        res.status(200).send({success: true});
      }
    }
  });  
}

function buildEstimateEmail(category, jobType, measurement, measurementUnit, applianceType, modifiers, additionals, price) {
  let body = common.mailHeader("Your 5 Minute Estimate");
  body += "<p>Hello,</p><br>";
  body += "<p>Below is a copy of the 5 Minute Estimate you requested. If you would like to "
       +  "receive an actual estimate, please reply to this email or call us at (440) 654-3802 "
       +  "to set up an appointment.</p>";
  body += "<h3><b>General Info</b></h3>";
  body += "<ul>";
  body += "<li>Category: " + category + "</li>";
  body += "<li>Job Type: " + jobType + "</li>";
  body += "<li>Size: " + measurement + " (" + measurementUnit + ")</li>";
  body += "</ul>";
  if(applianceType) {
    body += "<h3><b>Job Specifics</b></h3>";
    body += "<ul><li>Appliance Type: " + applianceType + "</li></ul>";
  }
  else {
    if(modifiers.length > 0) {
      body += "<h3><b>Job Specifics</b></h3>";
      body += "<ul>";
      modifiers.forEach(function(item) {
        body += "<li>" + item.name + ": " + item.value + "</li>";
      });
      body += "</ul>";
    }
    if(additionals.length > 0) {
      body += "<h3><b>Additional Info</b></h3>";
      body += "<ul>"
      additionals.forEach(function(item) {
        body += "<li>" + item + "</li>";
      });
      body += "</ul>";
    }
  }
  body += "<h3><b>Total Price: " + price + "</b></h3>";
  body += "<p>Thank you for your interest in our services!";
  body += common.mailFooter();
  return body;
}

function buildMfaEmail(username, code) {
  let body = common.mailHeader("Your Commander Care Login Verification Code");
  body += "<p>Hello <b>" + username + "</b>,</p>";
  body += "<p>To complete your login, please enter the following code:";
  body += "<div>";
  body += "<h3 style=\"display: inline\"><b id=\"verificationCode\">" + code + "</b></h3>";
  body += "<div>";
  body += "<p>The code expires in 15 minutes, but you can get a new one by logging in again or clicking \"sending another\" below the code "
        + "input box on the Authentication page</p>";
  body += "<br>";
  body += "<h4><b>What to do if you didn't request this code?</b></h4>";
  body += "<p>If you didn't request this code, it is likely <b>someone knows your password</b>. To ensure the security of your account, please:</p>";
  body += "<ul>";
  body += "<li>Login and change your password. To do this, click the Account Setting button located on the bottom right of the home page "
        + " and press the Change Password button once there.</li>";
  body += "<li>If any of your other accounts share the same password, follow that website's instructions to reset it there as well.</li>";
  body += "<li>Email <a href=\"mailto:security@commandercare.net\">security@commandercare.net</a> to alert us to the issue so we can investigate "
        + "our system for potential malicious activity.</li>";
  body += "</ul>";
  body += "<br>";
  body += "<p>At Commander Care, we believe security is the responsibility of everyone who works for us. We train our employees so they can "
      + "identify security risks and empower them to take action to prevent bad things from happening. Protecting your data is of utmost importance, "
      + "and we're continuing to implement new features to provide the most up-to-date security measures available.</p>";
  body += "<br><br>";
  body += "<p>Thank you for your choice to secure your account!";
  body += common.mailFooter();
  return body;
}

function buildContactEmail(name, email, number, message) {
  var body = "<b>" + name + "</b> sent the following message:<br><br>";
  body += "<p>" + message + "</p><br><br>";
  body += "<b>Contact Info:</b><br>";
  body += "<p>Email: " + email + "</p>";
  body += "<p>Number: " + (number ? number : "N/A") + "</p>";
  return body;
}

function buildContactEmailConfirmation(name) {
  let body = common.mailHeader("Thank You For Reaching Out!");
  body += "<p>Hello <b>" + name + "</b>,</p>";
  body += "<p>This is an automated email sent to confirm the receipt of your Contact Request. "
       + "We'll get back to you as soon as someone's available!</p><br>";
  body += "<p>Don't feel like waiting? Try giving us a call at (440) 654-3802</p>";
  body += "<br><br>";
  body += "<p>Once again, thanks for reaching out!";
  body += common.mailFooter();
  return body;
}

function buildNewUserEmail(username, url) {
  let body = common.mailHeader("Your Account is Ready");
  body += "<p>Hello,</p>";
  body += "<p>An account has been created for you on commandercare.net! Your username is <b>" + username + "</b>. "
       + "To set your password, please navigate to the link below and enter your desired password."
       + "To access your account in the future, click the \"Customer Portal\" button at either the top "
       + "or bottom of the homepage. Then, simply login using the password you set.</p><br>";
  body += "<a href=\"" + url + "\">Click Here to Set Your Password</a>";
  body += "<br><br>";
  body += "<p>Thank you, and welcome to Commander Care!";
  body += common.mailFooter();
  return body;
}

process.on('uncaughtException', (error) => {
  const mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: process.env.SUPPORT_EMAIL,
    subject: 'An Error Occured on the Website',
    text: `An error occurred: ${error.stack}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });

  console.error('Uncaught exception:', error);

});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

http.createServer(app).listen(process.env.PORT, function () {
  console.log('***** exp listening on port: ' + process.env.PORT);
});
module.exports = app;
