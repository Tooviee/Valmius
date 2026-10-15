import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

/** Private bucket for finalized report PDFs (SUPABASE-SETUP.md section 6). */
export const REPORTS_BUCKET = "reports";
const SIGNED_URL_SECONDS = 600;

export function reportPdfPath(orgId: string, exerciseId: string, version: number): string {
  return `${orgId}/${exerciseId}/v${version}.pdf`;
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

/** Uploads a finalized PDF. Never overwrites: a version's file is written once. */
export async function uploadReportPdf(path: string, pdf: Buffer): Promise<void> {
  const { error } = await getAdminClient()
    .storage.from(REPORTS_BUCKET)
    .upload(path, new Uint8Array(pdf), { contentType: "application/pdf", upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new StorageUnavailableError(
        `The Storage bucket "${REPORTS_BUCKET}" does not exist. Create it in the Supabase dashboard (Storage > New bucket, private).`,
      );
    }
    throw new Error(`Could not store the report PDF: ${error.message}`);
  }
}

/** A short-lived download URL that sets the browser's filename. */
export async function signedReportUrl(path: string, filename: string): Promise<string> {
  const { data, error } = await getAdminClient()
    .storage.from(REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: filename });
  if (error || !data)
    throw new Error(`Could not sign the report URL: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}
