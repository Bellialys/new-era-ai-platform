# AWS KMS + Vercel OIDC for provider credentials

## Status

Prepared for Stage 3.2. The application adapter exists in
`src/lib/server/aws-kms-data-key-provider.ts`, and the reusable live verifier
exists in `src/lib/server/credential-kms-canary.ts`.

The canaries have no route and are not invoked automatically. After AWS/Vercel setup,
a preview-only invocation must first use `createAwsKmsDataKeyProviderFromEnv()`
and pass that provider to `runCredentialKmsCanary()`, then run
`runAwsKmsExtraContextPolicyCanaryFromEnv()` to prove the IAM/KMS context-key allowlist
rejects unexpected context keys.

Live Vercel readiness probe on 2026-09-28:

- `AWS_REGION`: present;
- `AWS_ROLE_ARN`: absent;
- `AI_CREDENTIAL_KMS_KEY_ID`: absent;
- `VERCEL_OIDC_TOKEN`: absent in the preview runtime used by the probe;
- static AWS access key variables: absent.

The repository does not contain AWS credentials.

## Infrastructure source of truth

Use `infra/aws-kms-vercel-oidc.yaml`.

The stack creates:

- Vercel IAM OIDC provider for team `bellial-s-projects`, unless an existing provider ARN is supplied;
- one single-Region symmetric KMS key with automatic annual rotation;
- alias `alias/new-era-ai-provider-credentials`;
- a production IAM role trusted only by the New Era production Vercel subject;
- a separate preview IAM role trusted only by the New Era preview Vercel subject.

The roles can call only `kms:GenerateDataKey` and `kms:Decrypt`, and only on the stack KMS key.

KMS calls are additionally constrained to the exact encryption-context key set
`credential_id`, `provider`, `origin`, with `provider=openrouter`.

## Why separate preview and production roles

Preview and production get separate trust subjects and separate role ARNs. A preview deployment therefore cannot assume the production role even though both roles use the same KMS key.

This lets the first live KMS smoke test run in preview without broadening the production trust boundary.

## Deployment

CloudFormation deployment requires an authenticated AWS account with permission to create IAM and KMS resources. The currently connected tools do not expose AWS account mutation, so this stack cannot be applied from the present connector set.

Example AWS CLI deployment:

```bash
# Deploy the reviewed stack in the same AWS region used by the application.
aws cloudformation deploy \
  --stack-name new-era-ai-credential-kms \
  --template-file infra/aws-kms-vercel-oidc.yaml \
  --capabilities CAPABILITY_IAM

# Read the generated KMS and IAM identifiers after deployment.
aws cloudformation describe-stacks \
  --stack-name new-era-ai-credential-kms \
  --query 'Stacks[0].Outputs'
```

If an IAM OIDC provider for `https://oidc.vercel.com/bellial-s-projects` already exists:

```bash
# Reuse the existing provider instead of creating a duplicate.
aws cloudformation deploy \
  --stack-name new-era-ai-credential-kms \
  --template-file infra/aws-kms-vercel-oidc.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides ExistingVercelOidcProviderArn=arn:aws:iam::<account-id>:oidc-provider/oidc.vercel.com/bellial-s-projects
```

## Vercel environment mapping

After stack creation, configure:

Production:
- `AWS_REGION` = stack region;
- `AWS_ROLE_ARN` = `ProductionRoleArn`;
- `AI_CREDENTIAL_KMS_KEY_ID` = `CredentialKmsKeyArn`.

Preview:
- `AWS_REGION` = same stack region;
- `AWS_ROLE_ARN` = `PreviewRoleArn`;
- `AI_CREDENTIAL_KMS_KEY_ID` = `CredentialKmsKeyArn`.

Do not configure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_SESSION_TOKEN`. The runtime adapter rejects static AWS credentials.

Vercel OIDC must be enabled for the project so deployments receive a short-lived OIDC token. The IAM role then uses `sts:AssumeRoleWithWebIdentity`.

## Environment readiness check

After mapping the CloudFormation outputs into the target Vercel environment and before invoking the canary, run:

`npm run env:check -- --mode=kms`

The KMS mode requires `AWS_REGION`, `AWS_ROLE_ARN` and `AI_CREDENTIAL_KMS_KEY_ID`. It fails with the security exit code if `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or `AWS_SESSION_TOKEN` is present, because the provider-credential KMS path is Vercel OIDC-only.

## Required live verification

Before enabling provider credential persistence:

1. Preview obtains a Vercel OIDC token.
2. Preview assumes only the preview IAM role.
3. `GenerateDataKey(AES_256)` succeeds with the governed encryption context.
4. The plaintext DEK is used locally and wiped.
5. `runCredentialKmsCanary()` verifies that `Decrypt` with the identical encryption context succeeds.
6. The canary directly calls the data-key provider with a changed `credential_id`; only AWS KMS `InvalidCiphertextException` counts as a successful context-rejection proof. Timeout, throttling, credential or network errors fail the canary.
7. Run `runAwsKmsExtraContextPolicyCanaryFromEnv()`. It sends one intentional `GenerateDataKey` request with an extra `policy_probe_extra` encryption-context key. Only AWS `AccessDeniedException` counts as proof that the IAM/KMS allow statement rejected the extra key; timeout, disabled key, expired credentials or any other operational error fails closed. If AWS unexpectedly accepts the request, returned plaintext key material is wiped before the canary fails.
8. Static AWS credential variables remain absent.
9. No provider credential, DEK, ciphertext or AWS token appears in logs.
10. Remove any temporary preview-only invocation route/workflow after the canary.
11. Only after preview smoke passes are production role/env values enabled.

## Rollback and containment

- Application credential persistence remains disabled until live KMS verification passes.
- The KMS key uses `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`.
- KMS deletion has a 30-day pending window.
- Removing an IAM role or its trust permission immediately prevents new Vercel KMS access without deleting encrypted database data.
- Disabling the KMS key is an emergency containment action, not a normal rollback.

## References

- Vercel OIDC AWS documentation.
- AWS KMS `GenerateDataKey` and `Decrypt`.
- AWS KMS encryption-context condition keys.
- ADR-004 and DEC-018.
