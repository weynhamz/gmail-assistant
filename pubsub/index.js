const Auth = require('@google-cloud/express-oauth2-handlers');
const {Datastore} = require('@google-cloud/datastore');
const {google} = require('googleapis');
const gmail = google.gmail('v1');


const datastoreClient = new Datastore();



const requiredScopes = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify'
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
      data: {}
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
    maxResults: 1
  });
  const messageId = await checkForDuplicateNotifications(listMessagesRes.data.messages[0].id);

  // Get the message using the message ID.
  if (messageId) {
    const message = await gmail.users.messages.get({
      userId: email,
      id: messageId
    });

    return message;
  }
};

// Extract message ID, sender, attachment filename and attachment ID
// from the message.
const extractInfoFromMessage = (message) => {
  const messageId = message.data.id;

  let from;
  let filename;
  let attachmentId;

  const headers = message.data.payload.headers;
  for (var i in headers) {
    if (headers[i].name === 'From') {
      from = headers[i].value;
    }
  }

  const payloadParts = message.data.payload.parts;
  for (var j in payloadParts) {
    if (payloadParts[j].body.attachmentId) {
      filename = payloadParts[j].filename;
      attachmentId = payloadParts[j].body.attachmentId;
    }
  }

  return {
    messageId: messageId,
    from: from,
    attachmentFilename: filename,
    attachmentId: attachmentId
  };
};

// Get attachment of a message.
const extractAttachmentFromMessage = async (email, messageId, attachmentId) => {
  return gmail.users.messages.attachments.get({
    id: attachmentId,
    messageId: messageId,
    userId: email
  });
};

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels() {
  let ret = {};

  let labelsRes = await gmail.users.labels.list({
    userId: 'me',
  });
  
  let labels = labelsRes.data.labels;

  if (labels.length) {
    labels.forEach((label) => {
      ret[label.id] = label;
    });
  }
  
  return ret;
}

async function fixThreadLables(threadId) {
    let threadLabelIds = [];

    let messagesRes = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
    });

    let messages = messagesRes.data.messages;

    // Skip if only 1 message in thread
    if (messages.length <= 1) {
        return;
    }

    const Labels = await listLabels();

    // Loop through messages in the thread
    // to caculate thread labels
    messages.forEach((message) => {
        // only care about user labels
        let labelIds = message.labelIds.filter((labelId) => {
            if(Labels[labelId].type == 'system') {
                return false;
            }
            return true;
        });

        console.log('Message Label Ids:');
        console.log(labelIds);

        // Add to thread labels and make it unique
        threadLabelIds = [ ...new Set([...threadLabelIds, ...labelIds])];
    });

    // Skip if no thread labels found
    if (threadLabelIds.length == 0) {
        return;
    }

    console.log('Thread Label Ids:');
    console.log(threadLabelIds);

    // Apply labels to the entile thread
    await gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: {
            addLabelIds: threadLabelIds,
        },
    });

    console.log('=============');
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

  // Process the incoming message.
  const message = await getMostRecentMessageWithTag(email, historyId);
  if (message) {
    console.log(message);
    console.log("thread id" + message.data.threadId);
    
    if (message.data.threadId) {
      await fixThreadLables(message.data.threadId);
    }
    //const messageInfo = extractInfoFromMessage(message);
    //console.log(messageInfo);
  }
};
