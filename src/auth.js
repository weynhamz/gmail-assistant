const fs = require('fs').promises;

const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

/**
 * getNewToken.
 *
 * @param {Object} oAuth2Client
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', resolve);
  });

  rl.close();

  const token = await oAuth2Client.getToken(code);

  // Store the token to disk for later program executions
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token['tokens']));

  console.log('Token stored to', TOKEN_PATH);

  return token['tokens'];
}

/**
 * authorize.
 *
 * @param {Object} credentials
 */
async function authorize(credentials) {
  // eslint-disable-next-line
  const {client_secret, client_id, redirect_uris} = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  let token = null;

  try {
    // Check if we have previously stored a token.
    token = await fs.readFile(TOKEN_PATH);
    token = JSON.parse(token);
  } catch (e) {
    token = await getNewToken(oAuth2Client);
  }

  oAuth2Client.setCredentials(token);

  return oAuth2Client;
}

exports.authorize = authorize;
