import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client";

export const deletionRequest = z.object({
  user_id: z.string().min(1),
  credential_id: z.string().min(1),
  reason: z.string().min(1),
});

export type DeletionRequest = z.infer<typeof deletionRequest>;
export type DeletionResult = { user_id: string; revoked_sessions: string[]; credential_revoked: boolean; audit_event: string };

type Session = { session_id: string };

export async function deleteFintechAccount(client: InfraiClient, input: unknown): Promise<DeletionResult> {
  const request = deletionRequest.parse(input);
  const sessions = await client.request<Session[]>("GET", `/v1/auth/session/list_for_user/${encodeURIComponent(request.user_id)}`);
  const revoked: string[] = [];
  for (const session of sessions) {
    await client.request("POST", `/v1/auth/session/revoke/${encodeURIComponent(session.session_id)}`, { session_id: session.session_id });
    revoked.push(session.session_id);
  }
  await client.request("DELETE", `/v1/account/keys/revoke/${encodeURIComponent(request.credential_id)}`);
  return { user_id: request.user_id, revoked_sessions: revoked, credential_revoked: true, audit_event: `account_deleted:${request.reason}` };
}

export function clientResponse(error: unknown): { status: number; body: unknown } {
  if (error instanceof InfraiError) return { status: error.status >= 400 && error.status < 500 ? error.status : 502, body: { error: error.code, details: error.details } };
  return { status: 502, body: { error: "UPSTREAM_REQUEST_FAILED" } };
}

if (import.meta.main) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const input = { user_id: process.env.DELETE_USER_ID, credential_id: process.env.DELETE_CREDENTIAL_ID, reason: "gdpr_request" };
  const result = await deleteFintechAccount(new InfraiClient(key), input);
  console.log(JSON.stringify(result, null, 2));
}
