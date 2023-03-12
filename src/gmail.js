const {google} = require('googleapis');

/**
 * fixThreadLabels.
 *
 * @param {Object} auth
 * @param {string} threadId
 * @param {Object} Labels
 */
async function fixThreadLabels(auth, threadId, Labels) {
  const gmail = google.gmail({version: 'v1', auth});

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
    if (message.labelIds === undefined) return;

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

  console.info('Thread Label Ids: ' + threadLabelIds);

  // Apply labels to the entile thread
  await gmail.users.threads.modify({
    id: threadId,
    userId: 'me',
    requestBody: {
      addLabelIds: threadLabelIds,
    },
  });
}

exports.fixThreadLabels = fixThreadLabels;
