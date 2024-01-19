# Logging Module - [version 1.7](#markdown-header-version-17)

Defines a common module for logging to a Postgres database. Internal exceptions are logged to the console and not thrown back to the caller -- similar to log4Net.

**IMPORTANT:** Have a look at the notes on integrating the logging-module as a microservice in [Microservice Integration](https://bitbucket.org/transsightdev/payment-service/src/error-codes/LOGGING-INTEGRATION.md).

## Schema

![schema](/docs/schema.jpg "schema")

Since the log table identifies a **component**, the same table could be used for multiple projects such as ez-rider user and payment. The **context** identifies the source of the log message and could be a method name or some other value.

See the ERROR_CONDITION section of the [payment-service enumerations](https://bitbucket.org/transsightdev/payment-service/src/master/modules/enumerations.js) for an example of error_code values.

## Installation

Add a dependency to your project’s package.json (you may also need to provide credentials in the bitbucket url).

```
"logging-module": "git+https://bitbucket.org/transsightdev/logging-module.git"
```

### Create Database Table

The schema and table name will depend on the environment, and must match the settings in the **Logging Database Configuration File** section below.

```
SET SCHEMA 'public';

DROP TABLE IF EXISTS shared_logs;
DROP SEQUENCE IF EXISTS shared_logs_id_seq;

CREATE SEQUENCE shared_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE shared_logs
(
    id bigint NOT NULL DEFAULT nextval('shared_logs_id_seq'::regclass),
    level character varying(5) COLLATE pg_catalog."default" NOT NULL,
    component character varying(100) COLLATE pg_catalog."default" NOT NULL,
    context character varying(100) COLLATE pg_catalog."default" NOT NULL,
    agency_id BIGINT,
    agency_program_id BIGINT,
    error_code character varying(10) COLLATE pg_catalog."default",
    message text COLLATE pg_catalog."default",
    sso_id character varying(50) COLLATE pg_catalog."default",
    request_method character varying(10) COLLATE pg_catalog."default",
    request_url text COLLATE pg_catalog."default",
    request_body text COLLATE pg_catalog."default",
    response_code character varying(3) COLLATE pg_catalog."default",
    response_body text COLLATE pg_catalog."default",
    sql text COLLATE pg_catalog."default",
    data text COLLATE pg_catalog."default",
    stack text COLLATE pg_catalog."default",
    elapsed_time bigint,
    "timestamp" timestamp without time zone NOT NULL,
    CONSTRAINT shared_logs_pkey PRIMARY KEY (id)
) WITH (oids = false);

ALTER TABLE shared_logs OWNER to bartparkinguser;
```

### .env File

Using the logging-module as a microservice in another project, requires that these settings be added to the .env file of the parent project.

Using the logging-module standalone, such as running the logging-module-scheduler task, requires that these settings be added to a .env file in the root of the logging-module.

```
# for sending emails from the logging-module via AWS SES
# these may already be defined in the .env file of the component using the logging module

AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_EMAIL_REGION="..."
AWS_EMAIL_HOST="..."
AWS_SEND_HEALTH_CHECK_EMAIL_TO="..."
AWS_SEND_FROM_EMAIL_ADDRESS="..."

#
# Logging Module
#
LOGGING_MODULE_COMPONENT_NAME="Payment Service"
#
# log only this level or above, DEBUG|INFO|WARN|ERROR
LOGGING_MODULE_LEVEL="INFO"
#
# enable logging of Sequelize queries
LOGGING_MODULE_SQL_QUERIES="true"
#
# enable logging of ALL api requests
LOGGING_MODULE_API_REQUESTS="true"
#
# log api requests where the elapsed time exceeds x seconds,
# regardless of LOGGING_MODULE_API_REQUESTS setting
LOGGING_MODULE_API_REQUEST_THRESHOLD_SECONDS="15"
#
# send email notifications for ERROR messages within the past x minutes
# this setting only applies to the monitor() task in logging-module-scheduler.js
LOGGING_MODULE_MONITOR_THRESHOLD_MINUTES="15"
#
# delete log messages that are older than x number of days
# this setting only applies to the purge() task in logging-module-scheduler.js
LOGGING_MODULE_PURGE_THRESHOLD_DAYS="5"
```

### Logging Database Configuration File

A log-config.json file must be provided in the config folder of the logging-module: 
* When used as a microservice, that would be `/node_modules/logging-module/config/log-config.json`
* When used standalone, that would be `/logging-module/config/log-config.json`

This file has a similar structure to the database-config.json file used in other projects, and options will be selected based on the **NODE_ENV** setting in the .env file.

The **schema** and **tableName** properties are optional and default to 'public'.'shared_logs'.

```
{
  "staging": {
    "username": "payments",
    "password": "payments",
    "database": "MOD",
    "host": "ccta-mod.c0rwr3p0myjd.us-west-1.rds.amazonaws.com",
    "port": 5432,
    "schema": "logging",
    "tableName": "logs",
    "timezone": "America/Los_Angeles",
    "dialect": "postgres",
    "dialectOptions": {
      "useUTC": false,
      "decimalNumbers": true
    },
    "pool": {
      "max": 200,
      "idle": 30000
    }
  }
}
```

## Usage

The logging-module supports these methods which set the corresponding **level** in the log record:

* debug()
* info()
* warn()
* error()

### Basic Logging

```
logger.info({
  context: 'some method name',
  agency_id: 'optional',
  agency_program_id: 'optional',
  sso_id: 'optional',
  message: 'testing'
});
```

### Logging SQL Statements

```
logger.info({
  context: 'some method name',
  sql: 'SELECT * FROM ...'
});
```

### Logging Errors

```
logger.error({
  context: 'some method name',
  message: 'some error message', // optional
  err // optional
});
```

### Logging API Requests and Elapsed Time

[express-mung](https://www.npmjs.com/package/express-mung) middleware is used to capture request, response, and elapsed time. This is handled internally by the logging-module, and enabled by the the logging middleware. See the **Instantiate Logging Module** section of  [Microservice Integration](https://bitbucket.org/transsightdev/payment-service/src/error-codes/LOGGING-INTEGRATION.md) for details.

```
logger.info({
  context: 'some endpoint',
  request_method: 'GET'
  request_url: '...',
  request_body: 'optional JSON string',
  response_code: '',
  response_body: 'optional JSON string',
  elapsed_time: 9999
});
```

## Scheduled Tasks

The scheduler uses **node-cron** to run the health check and purge outdated log records. After deployment, set execute permissions on the scheduler and start using **pm2**:

```
sudo chmod +x logging-module-scheduler.js

pm2 start logging-module-scheduler.js
```

If a single logging database is used by multiple components, this will likely be done in a standalone installation of the logging-module and not in each component.

## Sentry
In order for logging module to log into Sentry, it requires DNS link of a Sentry project to be added in the appConstant.js.
You can find the Public DSN by going to Sentry and clicking Projects & Teams > {Project} > Settings > Client Keys (DSN).

If DNS is set in appConstant then, it will log it to both sentry and database
If DNS is NOT set in appConstant then, it will only log it to database.

# Change Log

## Changes in version 1.7

* Added "logging": false option to log-config.json to prevent console logging of queries against the logging database.

## Changes in version 1.6

* Using sequelize.

## Changes in version 1.5

* Added an optional error_code column to identify error conditions.

## Changes in version 1.4

* An .env file is NOT required in the root folder of the logging-module -- just include all logging module settings defined in the **Make Updates to your Project .env File** section below. 

## Changes in version 1.3

* Added optional agency_id and agency_program_id

```
ALTER TABLE public.shared_logs ADD COLUMN agency_id BIGINT DEFAULT NULL;
ALTER TABLE public.shared_logs ADD COLUMN agency_program_id BIGINT DEFAULT NULL;
```

## Changes in version 1.2

* Removed the requirement to pass a configuration object in the constructor. Instead, a log-config.json file must be provided in the config folder of the logging-module -- see the updated **Configuration File** section for more details.
* A logging-module-scheduler was added to run the health check and log cleanup using **node-cron**.
* ~~An .env file is now required in the root folder of the logging-module -- and should be a copy of your project's .env file and include all logging module settings defined in the **Make Updates to your Project .env File** section below.~~

## Changes in version 1.1

* Additional .env settings required for scheduled tasks.
* Removed DEFAULT now() from **timestamp** column since this will be set internally by the logging module.
