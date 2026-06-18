# Logging plugin features

A tour of what the Logging plugin gives you. See the
[package README](../../packages/logging/README.md).

## What it captures

Logs from three sources, tagged with which one they came from:

- **console** (`log`, `error`, `warn`, `info`, `debug`)
- **NestJS** logger (`log`, `error`, `warn`, `debug`, `verbose`), with the log's
  context
- **pino** (`info`, `error`, `warn`, `debug`, `trace`, `fatal`)

Each log carries its timestamp, severity, message, and any structured
attributes. NodeLens captures the active trace on each log, so logs are recorded
in the context of the request that produced them.

## Viewing logs

- **Table** view: time, severity, message, and logger.
- **Timeline** view: the same logs as a vertical stream with severity dots.
- Switch between the two with the segmented control.

## Finding logs

- Filter by **severity** (debug through fatal) and by **logger** (the list is
  built from the loggers seen so far).
- **Search** the full text of a log, case-insensitive.
- Rows with structured arguments that differ from the message expose an **Args**
  section with the pretty-printed values.
