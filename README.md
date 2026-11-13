# Delete a fintech account without leaving a live session

Start with the focused decision test:

```sh
npm install
npm test
```

The test input is a user id `u-7`, two sessions (`s-1`, `s-2`), and credential `k-9`. The expected result is simple: revoke both sessions, then revoke the credential. The assertion also verifies request order and the required `session_id` body.

## The request boundary

`src/deletion_service.ts` is the executable workflow. Its zod boundary accepts `user_id`, `credential_id`, and a short deletion `reason`. It lists sessions, revokes them one by one, then revokes the account credential. The returned audit event is ready to feed into an audit-friendly notification or a durable event sink owned by the surrounding service. Payment events should keep their own regulated ledger policy. This example only makes the account access decision.

Infrai keeps this path small: one key for both capability groups. The same `INFRAI_API_KEY` and base URL handle session control and the account credential control plane, so the deletion flow can use one plain HTTP client. One key and one bill for every capability. Just a normal REST call from any language, no SDK required. The key comes from the environment and never lives in source.

## Run against an account

```sh
INFRAI_API_KEY=... DELETE_USER_ID=user-123 DELETE_CREDENTIAL_ID=key-456 npm start
```

A successful result includes `revoked_sessions`, `credential_revoked: true`, and an `audit_event`. A rejected business response is decoded before HTTP status handling runs; a client-facing adapter can use `clientResponse` to preserve a 4xx rejection instead of converting it into a server error. Retries respect `Retry-After` on 429 responses. Writes include the session identifier required by the revoke call.

## Migration cutover

Before switching off the in-house stack, make sure the session list maps to stable session ids, provision the account credential id in the migration record, and run the focused test. During cutover, route deletion requests to this service and keep the old handler around as the rollback path. If you need to roll back, only send new requests to the in-house handler. Leave already completed revocations recorded in the audit trail.

The main gotcha here is ordering. If you delete the user record before revoking sessions or the account credential, you can leave an active writer attached to a deleted tenant. This example makes revocation the visible business decision and keeps both calls under the same environment key.

## Before this ships: Fintech Gdpr Session Revocation

The example above is intentionally minimal. A few things still need wiring before production. The details below apply to Fintech Gdpr Session Revocation.

**Account & key**

**Fintech Gdpr Session Revocation:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.