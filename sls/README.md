Gmail Asistant Serverless
=========================


A Serverless stack to be deployed on GCP to react on your incoming Gmail messages.

## Features

- [X] Fix message lables in the same thread.
- [ ] Recommend mail labels base on existing labels.
- [ ] Ability to apply actions based on custom rules to email.


## Installation


1. Set up a GCP Project

    As the stack is running on GCP, having a billing enabled GCP project is the first step.

    ```
    gcloud init
    gcloud projects create PROJECT_ID
    gcloud config set project PROJECT_ID
    ```

    Once the GCP project is ready, configure the `GCP_PROJECT` variable in `.env` file accordingly.

2. Enable below GCP Services

    * Gmail API
    * Google Cloud Pub/Sub
    * Google Cloud Functions
    * Google Cloud Datastore

3. Set up authentication credentials

    ```
    gcloud auth application-default login
    ```

4. Allow GCP Deployment Manager to manage IAM

    As we are using Serverless framework/Google Deployment Manager to [manage the IAM on resources](https://cloud.google.com/deployment-manager/docs/configuration/set-access-control-resources), the GCP project service account owner must be able to manage the IAM.

    ```
    gcloud projects add-iam-policy-binding [PROJECT_ID] --member serviceAccount:[PROJECT_ID]@cloudservices.gserviceaccount.com --role roles/owner
    ```

5. Set up OAuth consent screen and OAuth client

    Follow instructions [here](https://codelabs.developers.google.com/codelabs/intelligent-gmail-processing#3), run the `sls deploy` to get the required callback uri.
