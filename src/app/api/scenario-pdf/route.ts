import { renderScenarioPdf, scenarioPdfFilename } from "@/lib/pdf/render";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { scenarioSchema } from "@/lib/schemas/scenario";
import { logEvent } from "@/lib/supabase/events";

export const runtime = "nodejs";
export const maxDuration = 30;

// A schema-valid scenario is well under this; anything larger is not one.
const MAX_BODY_BYTES = 200_000;

/**
 * Renders the gated PDF for a scenario the browser posts back as form data.
 * The email gate is enforced in the UI; this route only rate-limits and validates.
 */
export async function POST(request: Request): Promise<Response> {
  const ipHash = getIpHash(request.headers);

  // A limiter outage does not block downloads: rendering a PDF spends nothing.
  if ((await checkRateLimit("pdf", ipHash)) === "blocked") {
    return new Response("Too many downloads from this address. Please try again later.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("Request too large.", { status: 413 });
  }

  let raw: FormDataEntryValue | null;
  try {
    raw = (await request.formData()).get("scenario");
  } catch {
    return new Response("Expected form data.", { status: 400 });
  }
  if (typeof raw !== "string" || raw.length > MAX_BODY_BYTES) {
    return new Response("Missing scenario.", { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("The scenario could not be read.", { status: 400 });
  }
  const parsed = scenarioSchema.safeParse(json);
  if (!parsed.success) {
    return new Response("The scenario could not be read.", { status: 400 });
  }

  const pdf = await renderScenarioPdf(parsed.data);
  await logEvent("pdf_downloaded", { type: parsed.data.type }, ipHash);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${scenarioPdfFilename(parsed.data)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
