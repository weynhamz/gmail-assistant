// express-oauth is a Google-provided, open-source package that helps automate
// the authorization process.
const Auth = require('@google-cloud/express-oauth2-handlers');

// Specify the access scopes required. If authorized, Google will grant your
// registered OAuth client access to your profile, email address, and data in
// your Gmail.
const requiredScopes = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
];

const auth = Auth('datastore', requiredScopes, 'email', true);


const restoreAuthClient = async (email) => {
  try {
    await auth.auth.requireAuth(null, null, email);
    return auth.auth.authedUser.getClient();
  } catch (err) {
    console.log('An error has occurred in the auth process.');
    console.log(err);
    throw err;
  }
};


const getAuthClientFromReqRes = async (req, res) => {
  try {
    const email = await auth.auth.authedUser.getUserId(req, res);
    return auth.auth.authedUser.getClient(req, res, email);
  } catch (err) {
    console.log('An error has occurred in the auth process.');
    console.log(err);
    throw err;
  }
};

exports.auth = auth;
exports.restoreAuthClient = restoreAuthClient;
exports.getAuthClientFromReqRes = getAuthClientFromReqRes;
