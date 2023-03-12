const fs = require('fs');

const {authorize} = require('./auth.js');

// Load client secrets from a local file.
fs.readFile('credentials.json', async (err, credentials) => {
  if (err) return console.log('Error loading client secret file:', err);

  // Authorize a client with credentials, then call the Gmail API.
  const auth = await authorize(JSON.parse(credentials));

  console.log(auth);
});
