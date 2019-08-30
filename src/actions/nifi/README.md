# NiFi and Action Hub

This is a library of actions for streaming data from Looker via scheduled actions.  The first one, nifi_sql, creates a NiFi-based workflow in which Looker is used as a SQL generator.  This guide assumes that you already have a functioning NiFi server

## Getting Started

Step 1 - Create a NiFi workflow

To begin, you will need to have a NiFi processor that listens on an HTTP address
