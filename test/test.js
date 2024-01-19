// for testing multi-component logging
const componentOne = require('./component-one');
const componentTwo = require('./component-two');
const componentThree = require('./component-three');

// for testing monitor and purge tasks
const logger = require('../logging-module')('test.js');

// for testing email
const { sendHealthCheckEmail } = require('../components');
const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

const testComponentLogging = () => {
  componentOne.info({
    context: 'test.js',
    message: 'testing'
  });
};

const testMultiComponentLogging = () => {
  componentOne.debug({
    context: 'test.js',
    message: 'testing'
  });
  
  componentTwo.info({
    context: 'test.js',
    agency_id: 11,
    agency_program_id: 22,
    message: 'testing'
  });
  
  componentThree.error({
    context: 'test.js',
    message: 'testing'
  });
};

const testHealthCheckEmail = () => {
  return sendHealthCheckEmail([
    {
      id: 1,
      level: 'ERROR',
      component: 'test.js',
      context: 'testHealthCheckEmail',
      message: 'oops',
      timestamp: moment().format()
    }
  ]);
};

const test = async () => {
  try {
    await testComponentLogging();
    await testMultiComponentLogging();
    // await logger.purge();
    // await logger.monitor();
    // await sendHealthCheckEmail([
    //   {
    //     id: 1,
    //     level: 'ERROR',
    //     component: 'test.js',
    //     context: 'testHealthCheckEmail',
    //     message: 'oops',
    //     timestamp: moment().format()
    //   }
    // ]);
    setTimeout(() => {
      console.log('\nDONE, press CTRL-C to exit');
    }, 5000);
  } catch (err) {
    console.error(err);
    console.log('\npress CTRL-C to exit');
  }
};

test();
