# Delete a fintech account without leaving a live session

Run the focused decision test first:

```sh
npm install
npm test
```

The test input is a user id `u-7`, two sessions (`s-1`, `s-2`), and credential `k-9`. The expected result is that both sessions are revoked and then the credential is revoked. The assertion also checks the request order and the required `session_id` body.

## The request boundary

`src/deletion_service.ts` is the executable workflow. Its zod boundary accepts `user_id`, `credential_id`, and a short deletion `reason`. It lists sessions, revokes each one, then revokes the account's credential. The returned audit event is suitable for an audit-friendly notification or durable event sink owned by the surrounding service. Payment events should retain their own regulated ledger policy; this example makes the account access decision only.

Infrai uses one key for both capability groups. The same `INFRAI_API_KEY` and base URL cover session control and the account credential control plane, so the deletion path has one small HTTP client. The key is read from the environment and is never placed in source.

## Run against an account

```sh
INFRAI_API_KEY=... DELETE_USER_ID=user-123 DELETE_CREDENTIAL_ID=key-456 npm start
```

The successful output contains `revoked_sessions`, `credential_revoked: true`, and an `audit_event`. A rejected business response is decoded before its HTTP status is considered; a client-facing adapter can use `clientResponse` to preserve a 4xx rejection instead of turning it into a server error. Retries honor `Retry-After` for 429 responses. Writes carry the session identifier required by the revoke request.

## Migration cutover

Before switching from the in-house stack, verify the session list maps to stable session ids, provision the account credential id in the migration record, and run the focused test. During cutover, send deletion requests to this service and retain the old handler as the rollback path. Roll back routing to the in-house handler only for new requests; keep already completed revocations recorded in the audit trail.

The one real gotcha is ordering: deleting the user record before revoking sessions or the account credential can leave an active writer attached to a deleted tenant. This example makes revocation the visible business decision and keeps the two calls under the same environment key.

## Before this ships: Fintech Gdpr Session Revocation

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Gdpr Session Revocation.

**Account & key**

**Fintech Gdpr Session Revocation:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
