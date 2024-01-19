--
-- Create connection_protection_logs table.
--
--
SET SCHEMA 'logs';
DROP TABLE IF EXISTS logs.connection_protection_logs;
DROP SEQUENCE IF EXISTS logs.connection_protection_logs_id_seq;
CREATE SEQUENCE logs.connection_protection_logs_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;
CREATE TABLE logs.connection_protection_logs
(
    id bigint NOT NULL DEFAULT nextval('connection_protection_logs_id_seq'::regclass),
    sso_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    booking_id text COLLATE pg_catalog."default" NOT NULL,
    request_method character varying(10) COLLATE pg_catalog."default" NOT NULL,
    request_url text COLLATE pg_catalog."default" NOT NULL,
    request_body text COLLATE pg_catalog."default" NOT NULL,
    response_code character varying(3) COLLATE pg_catalog."default",
    response_body text COLLATE pg_catalog."default",
    error_message text COLLATE pg_catalog."default",
    "timestamp" timestamp without time zone NOT NULL,
    CONSTRAINT connection_protection_logs_pkey PRIMARY KEY (id)
) WITH (oids = false);
ALTER TABLE connection_protection_logs
    OWNER to logs;