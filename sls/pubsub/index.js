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
      userId: email,
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

  const messages = await getMessagesChanged(email, historyId);
  console.log(messages);
};
