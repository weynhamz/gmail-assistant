const fs = require('fs');

const {google} = require('googleapis');

const {authorize} = require('./auth.js');
const {fixThreadLabels} = require('./gmail.js');

let count = 0;

// Load client secrets from a local file.
fs.readFile('credentials.json', async (err, credentials) => {
  if (err) return console.log('Error loading client secret file:', err);

  // Authorize a client with credentials, then call the Gmail API.
  const auth = await authorize(JSON.parse(credentials));

  const gmail = google.gmail({version: 'v1', auth});

  const Labels = {};

  const res = await gmail.users.labels.list({
    userId: 'me',
  });

  res.data.labels.forEach((label) => {
    Labels[label.id] = label;
  });

  console.log(Labels);


  let pageToken = null;
  let threadsRes = {};
  let threads;

  do {
    if (threadsRes.data !== undefined && threadsRes.data.nextPageToken !== undefined) {
      pageToken = threadsRes.data.nextPageToken;
    }

    threadsRes = await gmail.users.threads.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 100,
      pageToken: pageToken,
    });

    threads = threadsRes.data.threads;

    // Bail out if no thread found
    if (threads.length < 0) {
      console.log('No threads to process.');
      return;
    }

    for (const thread of threads) {
      console.log(thread);

      count++;

      await fixThreadLabels(auth, thread.id, Labels);

      console.log(`${count} Processed ${thread.id}`);
    }

    console.log('====================');

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (threadsRes.data.nextPageToken !== undefined);
});
