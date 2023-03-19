const {parentPort} = require('worker_threads');

const {authorize} = require('./auth.js');
const {fixThreadLabels} = require('./gmail.js');

parentPort.on('message', async (data) => {
  // Authorize a client with credentials, then call the Gmail API.
  const auth = await authorize(data.credentials);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fixThreadLabels(auth, data.thread.threadId, data.Labels);
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fixThreadLabels(auth, data.thread.threadId, data.Labels);
  }

  parentPort.postMessage(`${data.count} Processed ${data.thread.threadId}`);
});
