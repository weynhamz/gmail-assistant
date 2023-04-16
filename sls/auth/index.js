// googleapis is the official Google Node.js client library for a number of
// Google APIs, including Gmail.
const {google} = require('googleapis');
const gmail = google.gmail('v1');

const {auth, getAuthClientFromReqRes} = require('./helpers');

// Call the Gmail API (Users.watch) to set up Gmail push notifications.
// Gmail will send a notification to the specified Cloud Pub/Sun topic
// every time a new mail arrives in inbox.
const setUpGmailPushNotifications = () => {
  const GCP_PROJECT = process.env.GCP_PROJECT;
  const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC;

  return gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: `projects/${GCP_PROJECT}/topics/${PUBSUB_TOPIC}`,
    },
  });
};

// If the authorization process completes successfully, set up Gmail push
// notification using the tokens returned
const onSuccess = async (req, res) => {
  const AuthClient = await getAuthClientFromReqRes(req, res);

  // Set up the googleapis library to use the returned tokens.
  google.options({auth: AuthClient});

  try {
    await setUpGmailPushNotifications();
  } catch (err) {
    console.log(err);
    if (!err.toString().includes('one user push notification client allowed per developer')) {
      throw err;
    }
  }

  res.send(`Successfully set up Gmail push notifications.`);
};

// If the authorization process fails, return an error message.
const onFailure = (err, req, res) => {
  console.log(err);
  res.send(`An error has occurred in the authorization process.`);
};

// Export the Cloud Functions for authorization.
exports.auth_init = auth.routes.init;
exports.auth_callback = auth.routes.cb(onSuccess, onFailure);
