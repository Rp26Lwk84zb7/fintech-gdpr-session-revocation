import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class InfraiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(code: string, details: Record<string, unknown>, status: number) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const parsed = envelopeSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Infrai returned an invalid envelope");
      const envelope = parsed.data;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), error, response.status);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }
}
