const encryptor = require('./encryptor');
const Membership  = require("../../models/Membership.js");
const User  = require("../../models/User.js");
const crypto = require('crypto');

function encryptAndEncode(tempPassword) {
 return Buffer.from(encryptor.aesEncrypt(tempPassword)).toString('base64');
}

function decodeAndDecrypt(cipher) {
  return encryptor.aesDecrypt(Buffer.from(cipher, 'base64').toString('utf8'));
}

async function addResetToken(id, resetToken) {
  await Membership.findByPk(id).then(membership => {
    membership.resetToken = resetToken;
    return membership.save();
  }).then(updatedMembership => {
    console.log("Reset token added to Membership " + id);
  }).catch(error => {
    console.log("Error adding Reset Token to Membership " + id + ": " + error);
  });
}

function generateResetUrl(resetToken, validation, host) {
  return `https://${host}/portal/confirmResetPassword?token=${encodeURIComponent(resetToken)}&validation=${encodeURIComponent(validation)}`;
}

function checkIfUserExists(username) {
  return User.findOne({
    where: {
      username: username
    }
  })
    .then(user => {
      if (user) {
        return true;
      }
      return false;
    })
    .catch(error => {
      console.log('Error checking user existence:', error);
      throw error;
    });
}

function generateTemporaryPassword(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    password += characters.charAt(randomIndex);
  }
  return password;
}

function mailHeader(subject) {
  let body = "<body style=\"overflow-x: hidden\">";
  body += "<div style = \"width: 100%; background-color: #26265e; color: white; line-height: 3.5; padding: 0 1% 0 1%; margin-left: -1%; "
        + "margin-top: -1%; text-align: center;\"><h3>" + subject + "</h3></div>";
  return body;
}

function mailFooter() {
  let body = "<br><b><i>Commander Care Home Services, LLC</b></i><br>(440) 654-3802<br>"
  + "<a href=\"https://commandercare.net\">https://commandercare.net</a></p>";
  body += "<br>";
  body += "<div style=\"width:100%; background-color: #26265e; color:white; padding: 1% 1% 1% 1%; margin-left: -1%; margin-bottom: -1%; text-align: center;\">";
  body += "<img style=\"display:iniline-block; width: 30%;\" src=\"cid:logo@nodemailer.com\" alt=\"logo\" />";
  body += "</div>";
  body += "</body>";
  return body;
}

function calculateUnpaidHours(shifts) {
  let hours = 0.00;
  shifts.forEach(shift => {
    let clockIns = shift.clockIns.split(';');
    let clockOuts = shift.clockOuts.split(';');
    for(let i = 0; i < clockIns.length; ++i) {
      let clockInTime = parseTime(clockIns[i]);
      let clockOutTime = parseTime(clockOuts[i]);
      let timeDiff = clockOutTime - clockInTime;
      hours += (timeDiff / 1000 / 60 / 60);
    }
  });
  return hours;
}

function parseTime(timeStr) {
  const [time, meridian] = timeStr.split(' ');
  const [hours, minutes, seconds] = time.split(':');
  let parsedHours = parseInt(hours, 10);
  if (meridian === 'PM' && parsedHours < 12) {
    parsedHours += 12;
  }
  const date = new Date();
  date.setHours(parsedHours, minutes, seconds, 0);
  return date;
}

const logoEncoding = "data:image/png;base64,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"


module.exports = {encryptAndEncode, decodeAndDecrypt, addResetToken, generateResetUrl, checkIfUserExists, generateTemporaryPassword, mailHeader, mailFooter, calculateUnpaidHours, logoEncoding}