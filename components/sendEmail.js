const _ = require('lodash');

/**
 * Send Email using AWS SES
 * @returns Promise 
 */
module.exports = async (options) => {
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

  const client = new SESClient({
    region: process.env.AWS_EMAIL_REGION
  });

  let toAddresses = _.isArray(options.to) ? options.to : options.to.split(',');

  const params = {
    Destination: {
      ToAddresses: toAddresses
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: options.htmlBody
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: options.subject
      }
    },
    Source: process.env.AWS_SEND_FROM_EMAIL_ADDRESS
  };

  if (options.textBody) {
    params.Message.Body['Text'] = {
      Charset: 'UTF-8',
      Data: options.textBody
    };
  }

  return client.send(new SendEmailCommand(params));
};
