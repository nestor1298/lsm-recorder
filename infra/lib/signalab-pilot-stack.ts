import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  CfnOutput,
  Tags,
  aws_s3 as s3,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * SignalabPilotStack — minimal corpus-acquisition backend for the LSM pilot.
 *
 * Resources:
 *  - Two private, versioned, encrypted S3 buckets (recordings + consent archive).
 *  - One Cognito user pool with passwordless email-OTP sign-in.
 *  - One DynamoDB single-table design (`signalab-corpus`) with one GSI.
 *  - One least-privilege managed policy for the Next.js runtime to attach to a
 *    role/user that holds the credentials used by the app on Vercel.
 *
 * The buckets are the corpus archive: RemovalPolicy.RETAIN so a `cdk destroy`
 * never deletes participant data. There are NO public bucket policies.
 */
export class SignalabPilotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("project", "signalab");

    // Production origin is supplied via CDK context so we never hardcode it for
    // CORS in code: `cdk deploy -c prodOrigin=https://...`.
    const prodOrigin = this.node.tryGetContext("prodOrigin") as
      | string
      | undefined;
    const corsOrigins = [
      "http://localhost:3000",
      ...(prodOrigin ? [prodOrigin] : []),
    ];

    // ── S3: corpus archive buckets ──────────────────────────────────────────
    const corpusCors: s3.CorsRule = {
      allowedMethods: [
        s3.HttpMethods.PUT,
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
      ],
      allowedOrigins: corsOrigins,
      allowedHeaders: ["*"],
      exposedHeaders: ["ETag"],
      maxAge: 3000,
    };

    // Old versions (overwrites / soft-deletes) drop to Glacier Instant Retrieval
    // after 30 days. Current versions stay in Standard.
    const archiveLifecycle: s3.LifecycleRule = {
      id: "noncurrent-versions-to-glacier-ir",
      enabled: true,
      noncurrentVersionTransitions: [
        {
          storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
          transitionAfter: Duration.days(30),
        },
      ],
    };

    const makeArchiveBucket = (scopeId: string, bucketName: string) => {
      const bucket = new s3.Bucket(this, scopeId, {
        bucketName,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
        enforceSSL: true,
        cors: [corpusCors],
        lifecycleRules: [archiveLifecycle],
        removalPolicy: RemovalPolicy.RETAIN,
      });
      Tags.of(bucket).add("project", "signalab");
      Tags.of(bucket).add("role", "corpus-archive");
      return bucket;
    };

    const recordingsBucket = makeArchiveBucket(
      "RecordingsBucket",
      `signalab-recordings-${this.account}-${this.region}`,
    );
    const consentBucket = makeArchiveBucket(
      "ConsentBucket",
      `signalab-consent-${this.account}-${this.region}`,
    );

    // ── Cognito: passwordless email-OTP user pool ───────────────────────────
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "signalab-participants",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Passwordless email OTP is a managed sign-in factor that requires the
    // Essentials feature plan. We set it through the L1 escape hatch so this
    // compiles across CDK minor versions and maps directly to the documented
    // CloudFormation properties.
    //
    // NOTE: Cognito's managed sign-in policy requires PASSWORD to be one of the
    // allowed first-auth factors (it rejects EMAIL_OTP alone). PASSWORD is
    // listed only to satisfy that constraint — the app authenticates with
    // EMAIL_OTP exclusively, so the participant experience stays passwordless.
    const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.addPropertyOverride("UserPoolTier", "ESSENTIALS");
    cfnUserPool.addPropertyOverride(
      "Policies.SignInPolicy.AllowedFirstAuthFactors",
      ["PASSWORD", "EMAIL_OTP"],
    );

    const userPoolClient = new cognito.UserPoolClient(this, "WebClient", {
      userPool,
      userPoolClientName: "signalab-web",
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // Enable the choice-based USER_AUTH flow (required for managed email OTP).
    const cfnClient = userPoolClient.node
      .defaultChild as cognito.CfnUserPoolClient;
    cfnClient.addPropertyOverride("ExplicitAuthFlows", [
      "ALLOW_USER_AUTH",
      "ALLOW_REFRESH_TOKEN_AUTH",
    ]);

    // ── DynamoDB: single-table corpus store ─────────────────────────────────
    const table = new dynamodb.Table(this, "CorpusTable", {
      tableName: "signalab-corpus",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: "gsi1",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── IAM: least-privilege runtime policy ─────────────────────────────────
    // Attach this to whatever role/user the Next.js runtime uses (e.g. an IAM
    // user whose keys live in Vercel env vars). No other permissions.
    const appRuntimePolicy = new iam.ManagedPolicy(this, "AppRuntimePolicy", {
      managedPolicyName: "signalab-app-runtime",
      description:
        "Least-privilege access for the SignaLab Next.js runtime (S3 corpus objects + DynamoDB table).",
      statements: [
        new iam.PolicyStatement({
          sid: "CorpusObjectReadWrite",
          actions: ["s3:PutObject", "s3:GetObject"],
          resources: [
            recordingsBucket.arnForObjects("*"),
            consentBucket.arnForObjects("*"),
          ],
        }),
        new iam.PolicyStatement({
          sid: "CorpusTableAccess",
          actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query",
          ],
          resources: [table.tableArn, `${table.tableArn}/index/gsi1`],
        }),
      ],
    });

    // ── Outputs (mirror these into the app's .env.local) ────────────────────
    new CfnOutput(this, "AwsRegion", { value: this.region });
    new CfnOutput(this, "RecordingsBucketName", {
      value: recordingsBucket.bucketName,
    });
    new CfnOutput(this, "ConsentBucketName", {
      value: consentBucket.bucketName,
    });
    new CfnOutput(this, "CorpusTableName", { value: table.tableName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "AppRuntimePolicyArn", {
      value: appRuntimePolicy.managedPolicyArn,
      description: "Attach to the IAM role/user used by the Next.js runtime.",
    });
  }
}
