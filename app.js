require('dotenv').config();

const Promise = require('bluebird');

const TwilioSMSBot = require('botkit-sms');
const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER,
  json_file_store: '/tmp/data/conversation'
});

const mailgunClient = require('mailgun-js')({
  apiKey: process.env.MAILGUN_KEY,
  domain: process.env.MAILGUN_DOMAIN
});
const mailgunSender = `Moonshot Chatbot Failsafe Admin <${process.env
  .MAILGUN_SENDER}>`;

let bot = controller.spawn({});

function asyncContactAdmin(adminEmail, message) {
  return new Promise((resolve, reject) => {
    const data = {
      from: mailgunSender,
      to: adminEmail,
      subject: 'Chatbot Failsafe Alert',
      text: `Message '${message.text}' received from user ${message.from}, but ${message.to} is currently down.`
    };

    mailgunClient.messages().send(data, (err, body) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function asyncContactAdmins(messageReceived) {
  return new Promise((resolve, reject) => {
    const admins = process.env.ADMINS.split(',');
    if (!!admins && admins.length > 0) {
      const promises = [];

      admins.forEach(admin => {
        promises.push(asyncContactAdmin(admin, messageReceived));
      });

      Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch(err => {
          reject(err);
        });
    } else {
      reject(new Error('no admins to contact'));
    }
  });
}

const port = process.env.PORT || 3000;
controller.setupWebserver(process.env.PORT, function(err, webserver) {
  controller.createWebhookEndpoints(controller.webserver, bot, function() {
    console.log('TwilioSMSBot is online!');
  });
});

controller.hears('.*', 'message_received', (bot, message) => {
  bot.reply(
    message,
    `The service you are trying to reach is currently down or under maintance. Please check back later!`
  );

  asyncContactAdmins(message);
});
