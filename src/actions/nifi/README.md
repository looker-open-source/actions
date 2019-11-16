# NiFi and Action Hub

This is a library of actions for streaming data from Looker via scheduled actions.  The first one, nifi_sql, creates a NiFi-based workflow in which Looker is used as a SQL generator.  It sends detailed, inline JSON (which includes the sql query of the Look or explore being sent) from which the SQL query to generate the Look is extracted within NiFi for further use.  This guide assumes that you already have a functioning NiFi server.

## Getting Started

### Step 1 - Create a NiFi workflow

To begin, you will need to have a NiFi processor that listens on an HTTP address
![alt-text](https://github.com/samudzi/actions/blob/master/src/actions/nifi/screen1.png "Step 1, part 1")

Configure the processor based on how you want the listener to interact with incoming API requests
![alt-text](https://github.com/samudzi/actions/blob/master/src/actions/nifi/screen2.png "Step 1, part 2")

### Step 2 - Enable the Action in your Looker instance

This initial version of the NiFi action is very pared down, and does not require any parameters like API keys.  This will likely change as it is developed into a more production-ready action.  For now, the action simply needs to be enabled in the Actions UI panel.
![alt-text](https://github.com/samudzi/actions/blob/master/src/actions/nifi/screen3.png "Step 2")

### Step 3 - Input the URL of your NiFi listener endpoint

Lastly, once the action is enabled, enter the Nifi listener endpoint on the action form when you want to send your data to Nifi.  Once the Look/Explore is successfully sent (and received by the endpoint), your NiFi workflow will be triggered
![alt-text](https://github.com/samudzi/actions/blob/master/src/actions/nifi/screen4.png "Step 3")

If you are getting errors, head over to <your Looker instance base url>/admin/log to troubleshoot
![alt-text](https://github.com/samudzi/actions/blob/master/src/actions/nifi/screen5.png "Step 3")


