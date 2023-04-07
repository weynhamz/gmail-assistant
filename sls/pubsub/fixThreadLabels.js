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

  // Loop through messages in the thread
  // to caculate thread labels
  messages.forEach((message) => {
    const labelIds = message.labelIds.filter((labelId) => {
      // Process 'IMPORTANT' messeges
      if (labelId == 'IMPORTANT') {
        return true;
      }

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

  //
  // Remove 'IMPORTANT' label
  //
  // Gmail's 'IMPORTANT' marker is messed up
  addLabelIds = threadLabelIds.filter((labelId) => {
    if (labelId == 'IMPORTANT') {
      return false;
    }
    return true;
  });
  removeLabelIds = ['IMPORTANT'];

  //
  // Archive message labeled with jira but irrelevant to me
  //
  let ON_ME=false;
  let IS_IGNORE=false;
  addLabelIds.forEach((labelId) => {
    if (Labels[labelId].name == '0_ON_ME') {
      console.info('ON_ME');
      ON_ME=true;
    }
    if (Labels[labelId].name.match(/jira$/)) {
      console.info('IS_JIRA');
      IS_IGNORE=true;
    }
  });
  if (!ON_ME && IS_IGNORE) {
    removeLabelIds.push('INBOX');
  }

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
