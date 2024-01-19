const _ = require('lodash');
const sendEmail = require('./sendEmail');

module.exports = (records) => {
  let htmlBody = records.map(record => {
    let message = ['<li>', `${record.timestamp} - `];
    let clone = _.clone(record);
    delete clone.id;
    delete clone.timestamp;
    message.push(JSON.stringify(clone));
    return message.join('');
  }).join('');

  return sendEmail(Object.assign({
    subject: `Logging Module Health Check - ${process.env.NODE_ENV}`,
    to: process.env.AWS_SEND_HEALTH_CHECK_EMAIL_TO.split(','),
    htmlBody
  }));
};
