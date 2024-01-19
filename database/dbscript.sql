--
-- Create logging table.
--
-- Schema and table name will depend on the environment, 
-- and must match the configuration passed to the logging-module constructor.
--
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
    error_code INTEGER DEFAULT NULL,
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

ALTER TABLE shared_logs
    OWNER to bartparkinguser;