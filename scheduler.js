var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
const User  = require("./models/User.js");
const Employee  = require("./models/Employee.js");
const cron = require('node-cron');


var transporter = nodemailer.createTransport(smtpTransport({
  service: process.env.SMTP_SERVICE,
  host: process.env.SMTP,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}));

// auto clocking out employees that forgot 12AM EST every day
cron.schedule('0 5 * * *', async () => {
  await autoClockOut();
});


async function autoClockOut() {
  try {
    console.log('Auto clock out started...');
    let employees = await Employee.findAll();
    let users = await User.findAll();
    for(const employee of employees) {
      if(employee.clockedIn) {
        employee.clockedIn = false;
        await employee.save();
        let username = users.filter(u => u.id === employee.id)[0].username;
        console.log(username + ' forgot to clock out.');
        sendClockOutEmail(username);
      }
    }
    console.log('Auto clock task completed.');
  } catch (error) {
    console.error('Auto clock out error:', error);
  }
}

function sendClockOutEmail(username) {
  var mailOptions = {
    from: process.env.SUPPORT_EMAIL,
    to: process.env.COMMANDER_EMAIL,
    subject: username + ' Forgot to Clock Out',
    html: buildClockOutEmail(username)
  }
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.status(500).send(null);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });  
}

function buildClockOutEmail(username) {
  var date = new Date(Date.now());
  date = date.setDate(date.getDate() - 1);
  var body = "<b>" + username + "</b> forgot to clock out on ";
  body += new Date(date).toLocaleDateString('en-us', 'America/New_York');
  body += ".<br><p>Please get their hours and update in the database accordingly.</p>";
  return body;
}
