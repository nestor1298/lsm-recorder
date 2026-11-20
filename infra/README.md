# SignaLab infra (AWS CDK)

Infrastructure as code for the SignaLab LSM corpus pilot. One CDK v2 stack,
`SignalabPilotStack`, provisions the storage, auth, and database the Next.js app
needs. **Hosting stays on Vercel** in this iteration — see _Deuda_ below.

## What this stack creates

| Resource | Details |
| --- | --- |
| S3 `signalab-recordings-{account}-{region}` | Sign videos. Private (Block Public Access, all four), SSE-S3, versioned, CORS PUT/GET/HEAD from localhost + prod origin. |
| S3 `signalab-consent-{account}-{region}` | Consent videos. Same hardening. |
| Cognito user pool `signalab-participants` | Passwordless **email OTP** sign-in, self-signup, email as the only required attribute. One app client `signalab-web` (no secret). |
| DynamoDB `signalab-corpus` | Single-table, on-demand, `pk`/`sk` + GSI `gsi1` (`gsi1pk`/`gsi1sk`), point-in-time recovery on. |
| IAM `signalab-app-runtime` (managed policy) | Least privilege for the app runtime. Attach to the role/user whose keys the app uses. |

Both buckets and the table use `RemovalPolicy.RETAIN` — `cdk destroy` will **not**
delete participant data. There are no public bucket policies.

## DynamoDB single-table design

| Entity | `pk` | `sk` | `gsi1pk` | `gsi1sk` | Key attributes |
| --- | --- | --- | --- | --- | --- |
| Participant | `PART#{userId}` | `PROFILE` | — | — | `created_at`, `display_name?`, `metadata` (map, see app `ParticipantMetadata`), `consent_status` (`none\|granted\|withdrawn`), `consent_video_key?`, `default_access_tier` |
| Session | `PART#{userId}` | `SESS#{sessionId}` | — | — | `name`, `task_type` (`phonological`), `created_at`, `device_info`, `session_metadata` |
| Recording | `SESS#{sessionId}` | `REC#{cmId}` | `PART#{userId}` | `REC#{recorded_at}` | `participant_id`, `s3_key`, `duration_ms`, `recorded_at`, `status` (`pending\|recorded\|approved\|rejected`), `access_tier` (`abierto\|investigacion\|restringido`, default `restringido`), `withdrawn` (bool, default `false`), `notes?` |

Access patterns:

- Get a participant profile → `GetItem(pk=PART#{userId}, sk=PROFILE)`.
- List a participant's sessions → `Query(pk=PART#{userId}, sk begins_with SESS#)`.
- List recordings in a session → `Query(pk=SESS#{sessionId}, sk begins_with REC#)`.
- List **all** of a participant's recordings across sessions (for `/mis-grabaciones`)
  → `Query(gsi1, gsi1pk=PART#{userId}, gsi1sk begins_with REC#)`.

There is **no row-level security in DynamoDB**. The API layer is the security
boundary: every route handler verifies the Cognito access token and scopes
reads/writes to the caller's `userId`. Treat any unscoped query as a bug.

## Deploy (you run this — agents do not `cdk deploy`)

The stack takes account and region from the AWS profile you deploy with
(`CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION`); bucket names embed both.

```bash
cd infra && npm ci && npm run build

# One-time per account+region:
npx cdk bootstrap aws://<ACCOUNT>/<REGION> --profile <PROFILE>

# Always diff first. Pass the production origin used for S3 CORS.
# AMPLIFY_GITHUB_TOKEN is REQUIRED on every routine deploy: without it the
# Amplify app, branch, domain and compute role are omitted from the
# template and CloudFormation would DELETE them (they are not RETAIN).
read -s AMPLIFY_GITHUB_TOKEN && export AMPLIFY_GITHUB_TOKEN
npx cdk diff   -c prodOrigin=https://signalab.other-ai.com --profile <PROFILE>
npx cdk deploy -c prodOrigin=https://signalab.other-ai.com --profile <PROFILE>
unset AMPLIFY_GITHUB_TOKEN && rm -rf cdk.out   # cdk.out holds the token in plain text
```

Optional context:

- `-c skipDomain=true` — omit the `signalab.other-ai.com` association (a new
  account while the domain still points at the old app).
- `-c extraOrigins=https://a,https://b` — extra CORS origins for testing
  from the Amplify default URL before the DNS cutover.

Domain: after the first deploy the association is `PENDING_VERIFICATION`
until the two CNAME records from `aws amplify get-domain-association` exist
in Cloudflare (DNS only). Moving to another account: see
[docs/migracion-cuenta-aws.md](../docs/migracion-cuenta-aws.md).

### Runtime credentials

Create (or reuse) an IAM user/role, attach the `signalab-app-runtime` managed
policy (`AppRuntimePolicyArn` output), and put its access keys in the Vercel
project env as `SIGNALAB_AWS_ACCESS_KEY_ID` / `SIGNALAB_AWS_SECRET_ACCESS_KEY`
(the unprefixed `AWS_*` names are reserved by Vercel's Lambda runtime and may be
stripped or shadowed). These are
server-only; they are never shipped to the browser.

## Deuda / out of scope (intentional)

- **Hosting on AWS** (Amplify Hosting / App Runner) — the app still runs on
  Vercel with env-var credentials. Migration is a separate effort.
- Researcher/public read access to the `abierto` tier.
- Real purge pipeline for withdrawn recordings (soft-delete only today).
