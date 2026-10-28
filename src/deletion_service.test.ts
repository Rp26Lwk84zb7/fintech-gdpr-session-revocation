import test from "node:test";
import assert from "node:assert/strict";
import { InfraiClient } from "./infrai_client";
import { deleteFintechAccount } from "./deletion_service";

test("deletion revokes every session before the account credential", async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const client = new InfraiClient("test-key", "http://test");
  client.request = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path.includes("list_for_user")) return [{ session_id: "s-1" }, { session_id: "s-2" }];
    return {};
  };
  const result = await deleteFintechAccount(client, { user_id: "u-7", credential_id: "k-9", reason: "privacy_request" });
  assert.deepEqual(result.revoked_sessions, ["s-1", "s-2"]);
  assert.equal(result.credential_revoked, true);
  assert.deepEqual(calls.map((call) => call.path), [
    "/v1/auth/session/list_for_user/u-7",
    "/v1/auth/session/revoke/s-1",
    "/v1/auth/session/revoke/s-2",
    "/v1/account/keys/revoke/k-9",
  ]);
  assert.deepEqual(calls[1].body, { session_id: "s-1" });
});
