const {google} = require('googleapis');
const {PubSub} = require('@google-cloud/pubsub');
const {Datastore} = require('@google-cloud/datastore');

const Auth = require('@google-cloud/express-oauth2-handlers');

const gmail = google.gmail('v1');

const datastoreClient = new Datastore();

const requiredScopes = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
];

const auth = Auth('datastore', requiredScopes, 'email', true);

const GCP_PROJECT = process.env.GCP_PROJECT;
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC;
const PUBSUB_MESSAGE_TOPIC = process.env.PUBSUB_MESSAGE_TOPIC;

// if historyId is bigger or not recorded
//     store the historyId
//     fetch delta messages
// if historyId is smaller than recorded, do nothing
const getMessagesChanged = async (email, historyId) => {
  console.debug('Current historyId: ' + historyId);

  const datastoreKey = datastoreClient.key(['lastHistoryId', email]);
  const [lastHistoryId] = await datastoreClient.get(datastoreKey);

  if (!lastHistoryId) {
    console.debug('No recorded lastHistoryId.');
    await datastoreClient.save({
      key: datastoreKey,
      data: {
        lastHistoryId: historyId,
      },
    });
    return [];
  }

  if (lastHistoryId && historyId <= lastHistoryId.lastHistoryId) {
    console.debug('lastHistoryId: ' + lastHistoryId.lastHistoryId);
    return [];
  }

  if (lastHistoryId && historyId > lastHistoryId.lastHistoryId) {
    console.debug('lastHistoryId: ' + lastHistoryId.lastHistoryId);
    await datastoreClient.save({
      key: datastoreKey,
      data: {
        lastHistoryId: historyId,
      },
    });

    const listChanges = await gmail.users.history.list({
      userId: 'me',
      historyTypes: ['messageAdded'],
      startHistoryId: lastHistoryId.lastHistoryId,
    });

    console.debug('History Data:');
    console.debug(listChanges.data);

    const messagesAdded = {};

    if (listChanges.data.history) {
      listChanges.data.history.forEach((history) => {
        if (history.messages) {
          history.messages.forEach((message) => {
            messagesAdded[message.id] = message;
          });
        }
      });
    }

    console.debug('Changed Messages:');
    console.debug(messagesAdded);

    return Object.values(messagesAdded);
  }
};

// Creates a client; cache this for further use
const pubSubClient = new PubSub();

async function publishMessage(topicNameOrId, data) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(data);

  try {
    const messageId = await pubSubClient
        .topic(topicNameOrId)
        .publishMessage({data: dataBuffer});
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);

    process.exitCode = 1;
  }
}

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

  // TODO Record a timestamp, no need to watch everytime.
  gmail.users.watch({
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: `projects/${GCP_PROJECT}/topics/${PUBSUB_TOPIC}`,
    },
  });

  const messages = await getMessagesChanged(email, historyId);

  console.log(messages);

  let publishing = [];

  messages.forEach((message) => {
    const data = JSON.stringify({
      email: email,
      message: message,
    });

    publishing += publishMessage(PUBSUB_MESSAGE_TOPIC, data);
  });

  Promise.all(publishing);
};
