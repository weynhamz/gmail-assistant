const Auth = require('@google-cloud/express-oauth2-handlers');
const {Datastore} = require('@google-cloud/datastore');
const {google} = require('googleapis');
const gmail = google.gmail('v1');

const datastoreClient = new Datastore();

const requiredScopes = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
];

const auth = Auth('datastore', requiredScopes, 'email', true);

const checkForDuplicateNotifications = async (messageId) => {
  const transaction = datastoreClient.transaction();
  await transaction.run();
  const messageKey = datastoreClient.key(['emailNotifications', messageId]);
  const [message] = await transaction.get(messageKey);
  if (!message) {
    await transaction.save({
      key: messageKey,
      data: {},
    });
  }
  await transaction.commit();
  if (!message) {
    return messageId;
  }
};

const getMostRecentMessageWithTag = async (email, historyId) => {
  // Look up the most recent message.
  const listMessagesRes = await gmail.users.messages.list({
    userId: email,
    maxResults: 1,
  });
  const messageId = await checkForDuplicateNotifications(listMessagesRes.data.messages[0].id);

  // Get the message using the message ID.
  if (messageId) {
    const message = await gmail.users.messages.get({
      userId: email,
      id: messageId,
    });

    return message;
  }
};

exports.watchGmailMessages = async (event) => {
  // Decode the incoming Gmail push notification.
  const data = Buffer.from(event.data, 'base64').toString();
  const newMessageNotification = JSON.parse(data);
  const email = newMessageNotification.emailAddress;
  const historyId = newMessageNotification.historyId;

  try {
    await auth.auth.requireAuth(null, null, email);
  } catch (err) {
    console.log('An error has occurred in the auth process.');
    throw err;
  }
  const authClient = await auth.auth.authedUser.getClient();
  google.options({auth: authClient});

  // Process the incoming message.
  const message = await getMostRecentMessageWithTag(email, historyId);
  if (message) {
    console.log(message);
  }
};
