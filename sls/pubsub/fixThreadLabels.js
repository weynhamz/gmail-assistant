const {google} = require('googleapis');
const Auth = require('@google-cloud/express-oauth2-handlers');

const requiredScopes = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
];
const auth = Auth('datastore', requiredScopes, 'email', true);

const gmail = google.gmail('v1');

/**
 * Lists the labels in the user's account.
 */
async function listLabels() {
  const ret = {};

  const labelsRes = await gmail.users.labels.list({
    userId: 'me',
  });

  const labels = labelsRes.data.labels;

  if (labels.length) {
    labels.forEach((label) => {
      ret[label.id] = label;
    });
  }

  return ret;
}

async function fixThreadLabels(threadId) {
  const Labels = await listLabels();

  let threadLabelIds = [];

  const messagesRes = await gmail.users.threads.get({
    id: threadId,
    userId: 'me',
  });
  const messages = messagesRes.data.messages;

  // Skip if only 1 message in thread
  if (messages.length <= 1) {
     return;
  }

  // Loop through messages in the thread
  // to caculate thread labels
  messages.forEach((message) => {
    const labelIds = message.labelIds.filter((labelId) => {
      // Care only the user labels
      if (Labels[labelId].type == 'system') {
        return false;
      }

      return true;
    });

    console.info('Message Label Ids: ' + labelIds);

    // Add to thread labels and deduplicate
    threadLabelIds = [...new Set([...threadLabelIds, ...labelIds])];
  });

  // Skip if no thread label found
  if (threadLabelIds.length == 0) {
    console.log('No label to process, bail out.');
    return;
  }

  let addLabelIds = [];
  let removeLabelIds = [];

  addLabelIds = threadLabelIds;

  console.info('addLabelIds:' + addLabelIds);
  console.info('removeLabelIds:' + removeLabelIds);

  // Apply labels to the entile thread
  await gmail.users.threads.modify({
    id: threadId,
    userId: 'me',
    requestBody: {
      addLabelIds: addLabelIds,
      removeLabelIds: removeLabelIds,
    },
  });
}

exports.fixThreadLabels = async (event) => {
  console.debug(event);

  // Decode the incoming event payload
  const data = Buffer.from(event.data, 'base64').toString();
  const payload = JSON.parse(data);

  console.debug(payload);

  try {
    await auth.auth.requireAuth(null, null, payload.email);
    const authClient = await auth.auth.authedUser.getClient();
    google.options({auth: authClient});
  } catch (err) {
    console.log('An error has occurred in the auth process.');
    throw err;
  }

  await fixThreadLabels(payload.message.threadId);
};
