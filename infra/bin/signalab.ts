#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { SignalabPilotStack } from "../lib/signalab-pilot-stack";

const app = new cdk.App();

new SignalabPilotStack(app, "SignalabPilotStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    "SignaLab corpus pilot: S3 archive buckets, Cognito passwordless auth, DynamoDB corpus table",
  tags: { project: "signalab" },
});

app.synth();
