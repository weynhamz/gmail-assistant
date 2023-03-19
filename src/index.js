const fs = require('fs');

const {google} = require('googleapis');
const {Worker} = require('worker_threads');

const {authorize} = require('./auth.js');

const worker = new Worker('./src/worker.js');

let concurrency = 0;

worker.on('message', (result) => {
  concurrency--;

  console.log(`${result}`);
});

worker.on('error', (error) => {
  console.log(error);
});

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

    threadsRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 100,
      pageToken: pageToken,
    });

    threads = threadsRes.data.messages;

    // Bail out if no thread found
    if (threads.length < 0) {
      console.log('No threads to process.');
      return;
    }

    for (const thread of threads) {
      console.log(thread);

      while (concurrency > 5) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      count++;

      concurrency++;

      worker.postMessage({
        count: count,
        credentials: JSON.parse(credentials),
        thread: thread,
        Labels: Labels,
      });
    }

    console.log('====================');

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (threadsRes.data.nextPageToken !== undefined);
});
