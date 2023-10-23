const express = require('express');
const router = express.Router();
const db = require("../db.js").con;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cryptoJS = require('crypto-js');
const base32 = require('hi-base32');
const { totp } = require('otplib');
const encryptor = require('./lib/encryptor');
const { join } = require('path');
const common = require('./lib/common');
const User  = require("../models/User.js");
const Membership  = require("../models/Membership.js");

router.use(bodyParser.urlencoded({ extended : true }));

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

router.get('/', function(req, res, next) {
  if(req.session.isLoggedIn) {
    let redirectUrl = "/";
    console.log("permission: " + req.session.permissionLevel);
    switch(req.session.permissionLevel) {
      case "admin":
        redirectUrl = '/portal/admin/';
        break;
      case "Employee":
        redirectUrl = '/portal/employee/';
        break;
      case "Customer":
        redirectUrl = '/portal/customer/';
        break;
      default:
        redirectUrl = '/portal/login';
        break;
    }
    res.redirect(redirectUrl);
  }
  else {
    res.redirect('/portal/login');
  }
});

router.get('/logout', function(req, res, next) {
  req.session.isLoggedIn = false;
  req.session.userName = null;
  req.session.permissionLevel = null;
  req.session.destroy(function(err) {
    if (err) {
      console.log(error);
    } else {
      res.clearCookie('session-id'); 
      res.redirect('/portal');
    }
  });
  
});

router.get('/login', function(req, res, next) {
  if(req.session.isLoggedIn) {
    res.redirect('/portal');
    return;
  }
  res.render('./portal/login', { error: false });
});

// POST and GET admin/main page.
router.post('/login', function(req, res, next) {
  if(req.session.isLoggedIn) {
    res.redirect('/portal');
    return;
  }

  let val = req.body;
  let userName = val.userName.toLowerCase();
  let userPassword = val.userPassword;
  
  // search for row in table with given username
  // user input automatically sanitized
  let query = 'Select * From users where username=?';
  db.query(query, [userName], function(error, data) {
    if(error || data.length === 0) {
      console.log('login failed, no user found');
      res.render('./portal/login', {error: true});
      return;
    }
    let user = data[0];
    query = 'Select * From memberships where id=?';
    db.query(query, [user.id], function(error, data) {
      if(error || data.length === 0) {
        console.log('login failed, no membership found');
        res.render('./portal/login', {error: true});
        return;
      }
    
      // hash inputted password and compare to hash in table
      // salt is saved in table (will be unique for each user and
      // generated upon registration/password set)
      let membership = data[0];
      bcrypt.hash(userPassword, membership.salt, function(err, hash) {
        if(err) {
          console.log(err);
          res.render('./portal/login', {error: true});
          return;
        }

        // compare user input to db value
        // redirect to homepage if valid
        if(hash === membership.passwordHash) {
          query = 'Select * From mfa where id=?';
          db.query(query, [user.id], function(error, data) {
            if(error || data.length === 0) {
              console.log('login failed, no mfa stats');
              res.render('./portal/login', {error: true});
              return;
            }
            mfaInfo = data[0];
            var rememberedTokens = mfaInfo.rememberedTokens === null ? null : mfaInfo.rememberedTokens.split(',');
            if(val.token !== null && rememberedTokens !== null && rememberedTokens.includes(bcrypt.hashSync(val.token, membership.salt))) {
              validateUser(req, res, user, membership);
              return;
            }
            let authToken = createAuthToken(userName, userPassword);
            res.redirect('/portal/authenticate?authToken=' + encodeURIComponent(authToken) + '&email=' + encodeURIComponent(censorEmail(user.email)) + '&appEnabled=' + mfaInfo.appEnabled);
          });
        }
        else {
          console.log('login failed for ' + user.username + ', bad password');
          res.render('./portal/login', {error: true});
          return;
        }
      });
    });
  });
});

router.get('/authenticate', function(req, res, next) {
  // TODO: change username/password fields to single auth token when made
  const authenticateInfo = {
    authToken: req.query.authToken,
    email: req.query.email,
    appEnabled: req.query.appEnabled
  }
  res.render('./portal/authenticate', authenticateInfo);
});

router.post('/authenticate', function(req, res, next) {
  // TODO: parse auth token into username and password when made
  let username = Buffer.from(req.body.authToken, 'base64').toString('utf8').split(';')[0].toLowerCase();
  let password = encryptor.aesDecrypt(Buffer.from(req.body.authToken, 'base64').toString('utf8').split(';')[1]);
  let mfaType = req.body.mfaChoice;
  let code = req.body.code; 
  
  // search for row in table with given username
  // user input automatically sanitized
  let query = 'Select * From users where username=?';
  db.query(query, [username], function(error, data) {
    if(error || data.length === 0) {
      console.log('login failed, no user found');
      res.render('./portal/authenticate', {error: true});
      return;
    }
    let user = data[0];
    query = 'Select * From memberships where id=?';
    db.query(query, [user.id], function(error, data) {
      if(error || data.length === 0) {
        console.log('login failed, no membership found');
        res.render('./portal/authenticate', {error: true});
        return;
      }
    
      // hash inputted password and compare to hash in table
      // salt is saved in table (will be unique for each user and
      // generated upon registration/password set)
      let membership = data[0];
      bcrypt.hash(password, membership.salt, function(err, hash) {
        if(err) {
          console.log(err);
          res.render('./portal/authenticate', {error: true});
          return;
        }

        // compare user input to db value
        // redirect to homepage if valid
        if(hash === membership.passwordHash) {
          query = 'Select * From mfa where id=?';
          db.query(query, [user.id], function(error, data) {
            if(error || data.length === 0) {
              console.log('login failed, no mfa stats');
              res.render('./portal/login', {error: true});
              return;
            }
            mfaInfo = data[0];
            var authenticated;
            switch(mfaType) {
              case "email":
                authenticated = validateEmail(mfaInfo, code);
                break;
              case "app":
                authenticated = validateApp(mfaInfo, code);
                break;
              default:
                authenticated = false;
                break;
            }
            if(authenticated) {
              if(req.body.rememberToken) {
                var rememberedList = mfaInfo.rememberedTokens === null ? [] : mfaInfo.rememberedTokens.split(',');
                var tokenHash = bcrypt.hashSync(req.body.rememberToken, membership.salt);
                if(rememberedList !== [] && !rememberedList.includes()) {
                  rememberedList.push(tokenHash);
                }
                var joinedRememberList = rememberedList.join(',');
                let query = "Update mfa Set rememberedTokens=? Where id=?";
                db.query(query, [joinedRememberList, membership.id], function(error, results) {
                  if(error) {
                    console.log(error);
                  }
                });
              }
              validateUser(req, res, user, membership);
              return;
            }
          });
        }
        else {
          res.render('./portal/authenticate', {error: true});
          return;
        }
      });
    });
  });
});

router.get('/resetPassword', function(req, res, next) {
  res.render('./portal/resetPassword');
});

router.post('/resetPassword', function(req, res, next) {
  let data = req.body;
  if(!data.username || !data.email) {
    res.redirect('./resetPasswordSent');
    return;
  }
  common.checkIfUserExists(data.username).then(exists => {
    if(!exists) {
      res.redirect('./resetPasswordSent');
      return;
    }
    User.findOne({
      where: {
        username: data.username
      }
    })
      .then(user => {
        if(user && user.email.toLowerCase() === data.email.toLowerCase()) {
          Membership.findByPk(user.id).then(membership => {
            if(membership) {
              let tempPassword = common.generateTemporaryPassword(6);
              let hashedPassword = bcrypt.hashSync(tempPassword, membership.salt);
              membership.passwordHash = hashedPassword;
              membership.save().then(updatedMembership => {
                let resetToken = crypto.randomUUID();
                common.addResetToken(membership.id, resetToken);
                let validation = common.encryptAndEncode(tempPassword);
                let resetUrl = common.generateResetUrl(resetToken, validation, req.get('host'));
                sendPasswordResetEmail(user.email, user.username, tempPassword, resetUrl);
                res.redirect('./resetPasswordSent');
                return;
              });
            }
          });
        }
        else {
          res.redirect('./resetPasswordSent');
        }
      });
  });
});

router.get('/resetPasswordSent', function(req, res, next) {
  res.render('./portal/resetPasswordSent');
});

router.get('/confirmResetPassword', function(req, res, next) {
  let data = req.query;
  res.render('./portal/confirmResetPassword', {token: data.token, validation: data.validation, error: null});
});

router.post('/confirmResetPassword', function(req, res, next) {
  let data = req.body;
  if(!data.username || !data.email) {
    res.render('./portal/confirmResetPassword', {token: data.token, 
                                                 validation: data.validation, 
                                                 error: "Invalid username or email. Please try again."});
    return;
  }
  if(!data.token || !data.validation) {
    res.render('./portal/confirmResetPassword', {token: data.token, 
                                                validation: data.validation, 
                                                error: "Please make sure you're using the latest reset email sent, or request another one and try again."});
    return;
  }
  common.checkIfUserExists(data.username).then(exists => {
    if(!exists) {
      res.render('./portal/confirmResetPassword', {token: data.token, 
                                                   validation: data.validation, 
                                                   error: "Invalid username. Please try again."});
      return;
    }
    User.findOne({
      where: {
        username: data.username
      }
    })
      .then(user => {
        if(user && user.email.toLowerCase() === data.email.toLowerCase()) {
          console.log("user found");
          Membership.findByPk(user.id).then(membership => {
            if(membership) {
              console.log("membership found");
              let validationPassword = common.decodeAndDecrypt(data.validation);
              let hashedPassword = bcrypt.hashSync(validationPassword, membership.salt);
              if(hashedPassword === membership.passwordHash && data.token === membership.resetToken) {
                validateUserNoRedirect(req, user, membership);
                const queryString = `?resetPassword=true&password=${encodeURIComponent(validationPassword)}`;
                const redirectUrl = "./changePassword" + queryString;
                res.redirect(redirectUrl);
                return;
              }
              else {
                  res.render('./portal/confirmResetPassword', {token: data.token, 
                                                              validation: data.validation, 
                                                              error: "Please make sure you're using the latest reset email sent, or request another one and try again."});
                  return;
              }
            }
            else {
              res.render('./portal/confirmResetPassword', {token: data.token, 
                                                           validation: data.validation, 
                                                           error: "Invalid username or email. Please try again."});
            }
          });
        }
        else {
          res.render('./portal/confirmResetPassword', {token: data.token, 
                                                       validation: data.validation, 
                                                       error: "Invalid email. Please try again."});
        }
      });
  });
});

router.get('/changePassword', function(req, res, next) {
  if(!req.session.isLoggedIn) {
    res.redirect('./');
  }
  let data = req.query;
  let resetPassword = !data.resetPassword ? false : data.resetPassword;
  let password = !data.password ? null : data.password;
  res.render('./portal/changePassword', {resetPassword, password, error: null});
});

router.post('/changePassword', function(req, res, next) {
  if(!req.session.isLoggedIn) {
    res.redirect('./');
  }
  let data = req.body;
  if(data.newPassword !== data.confirmPassword) {
    res.render('./portal/changePassword', {resetPassword: data.resetPassword, password: data.password, error: "New passwords must match"});
    return;
  }
  if(data.newPassword.length < 8) {
    res.render('./portal/changePassword', {resetPassword: data.resetPassword, password: data.password, error: "New password must be at least 8 characters long"});
    return;
  }
  let username = req.session.userName
  common.checkIfUserExists(username).then(exists => {
    if(!exists) {
      console.log("No user found when changing password (username: " + username + ")");
      res.redirect('./');
      return;
    }
    User.findOne({
      where: {
        username: username
      }
    })
      .then(user => {
        if(user) {
          Membership.findByPk(user.id).then(membership => {
            if(membership) {
              let hashedPassword = bcrypt.hashSync(data.password, membership.salt);
              if(hashedPassword !== membership.passwordHash) {
                console.log(data.password+'//'+hashedPassword+'//'+membership.passwordHash);
                res.render('./portal/changePassword', {resetPassword: data.resetPassword, password: data.password, error: "Current password incorrect"});
                return;
              }
              let newPasswordHash = bcrypt.hashSync(data.newPassword, membership.salt);
              if(newPasswordHash === membership.passwordHash) {
                res.render('./portal/changePassword', {resetPassword: data.resetPassword, password: data.password, error: "New password can't be same as current password"});
                return;
              }
              membership.passwordHash = newPasswordHash;
              membership.save().then(updatedMembership => {
                res.redirect('./');
                return;
              });
            }
          });
        }
        else {
          console.log("No user found when changing password (username: " + username + ")");
          res.redirect('./');
        }
      });
  });
});

function validateEmail(mfaInfo, code) {
  let currentTime = new Date(Date.now());
  let valid = code === mfaInfo.emailCode;
  valid = valid && (currentTime - mfaInfo.codeExpiration < 0);
  valid = valid && (mfaInfo.attempts < 4);
  if(valid) {
    let query = "Update mfa Set codeExpiration = ?, attempts = ? Where id=?";
    db.query(query, [new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' '), 0, mfaInfo.id], function(error, results) {
      if(error) {
        console.log(error);
      }
    });
    return true;
  }
  let query = "Update mfa Set attempts = ? Where id = ?";
  db.query(query, [mfaInfo.attempts + 1, mfaInfo.id], function(error, results) {
    if(error) {
      console.log(error);
    }
  });
  return false;
}

function validateApp(mfaInfo, code) {
  let decryptedSecret = encryptor.aesDecrypt(mfaInfo.appSecret);
  if(totp.verify({token: code, secret: decryptedSecret})) {
    let timeWindowUsed = Math.floor(new Date().getTime() / 1000 * 30);
    if(timeWindowUsed !== mfaInfo.timeWindowUsed) {
      let query = "Update mfa Set timeWindowUsed=? where id=?";
      db.query(query, [timeWindowUsed, mfaInfo.id], function(error, results) {
        if(error) {
          console.log(error);
        }
      });
      return true;
    }
    return false;
  }
}

function validateUser(req, res, user, membership) {
  console.log('user %s logged in at %s from ip address %s', user.username, new Date(Date.now()), req.ip);
  // assignmnents to session
  req.session.isLoggedIn = true;
  // store user permission level to session file
  req.session.permissionLevel = membership.role;
  req.session.userName = user.username; // store user user name to session file
  req.session.userId = user.id; // store id for clock in/out verification for employees
  let query = 'Update memberships Set lastLoginDate=? Where id=?';
  db.query(query, [membership.id, new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ')], function(error, data) {
    if(error) {
      console.log("Unable to update lastLogin for %s", user.username);
    }
    res.redirect('/portal');
  });
}

function validateUserNoRedirect(req, user, membership) {
  console.log('user %s logged in at %s from ip address %s', user.username, new Date(Date.now()), req.ip);
  // assignmnents to session
  req.session.isLoggedIn = true;
  // store user permission level to session file
  req.session.permissionLevel = membership.role;
  req.session.userName = user.username; // store user user name to session file
  let query = 'Update memberships Set lastLoginDate=? Where id=?';
  db.query(query, [membership.id, new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' ')], function(error, data) {
    if(error) {
      console.log("Unable to update last Login for %s", user.username);
    }
  });
}

function createAuthToken(userName, userPassword) {
  let encryptedPassword = encryptor.aesEncrypt(userPassword);
  return Buffer.from(userName + ';' + encryptedPassword).toString('base64');
}

function censorEmail(email) {
  let splitEmail = email.split('@');
  return splitEmail[0].substr(0, 3) + "*".repeat(splitEmail[0].length - 3) + "@"
          + splitEmail[1].substr(0, 3) + "*".repeat(splitEmail[1].length - 3);
}

function sendPasswordResetEmail(email, username, tempPassword, url) {
  var mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: email,
    subject: 'A Password Reset Was Requested',
    html: buildPasswordResetEmail(username, url),
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

function buildPasswordResetEmail(username, url) {
  let body = common.mailHeader("A Password Reset Was Requested");
  body += "<p>Hello,</p>";
  body += "<p>An password reset has been requested for your account on commandercare.net! Your username is <b>" + username + "</b>. "
       + "To reset your password, please navigate to the link below and enter your desired password.</p>"
  body += "<br><a href=\"" + url + "\">Click Here to Set Your Password</a>";
  body += "<br><br>";
  body += "<p>Thank you for choosing Commander Care!";
  body += common.mailFooter();
  return body;
}

module.exports = router;