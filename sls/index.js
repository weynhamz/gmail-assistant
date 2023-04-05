'use strict';

const {auth_init, auth_callback} = require('./auth');
const {watchGmailMessages} = require('./pubsub');
const {fixThreadLabels} = require('./pubsub/fixThreadLabels');

exports.http = (request, response) => {
  response.status(200).send('Hello World!');
};

exports.event = (event, callback) => {
  callback();
};

exports.auth_init = auth_init;
exports.auth_callback = auth_callback;
exports.watchGmailMessages = watchGmailMessages;
exports.fixThreadLabels = fixThreadLabels;
