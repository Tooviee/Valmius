"use client";

import { useActionState, useState } from "react";
import { Markdown } from "@/components/plan/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  NARRATIVE_MAX_LENGTH,
  REPORT_NARRATIVE_SECTIONS,
  type ReportNarrative,
} from "@/lib/schemas/report";
import { finalizeReportAction, saveReportDraftAction } from "@/server/actions/report";
import type { FinalizeReportState, SaveReportState } from "@/server/actions/types";

const saveInitial: SaveReportState = { status: "idle" };
const finalizeInitial: FinalizeReportState = { status: "idle" };

const ORIGIN_LABEL: Record<ReportNarrative["origin"], string | null> = {
  model: null,
  template: "Template: needs review",
  user: "Edited",
};

/**
 * The narrative sections of a draft report: the only part a facilitator edits. The factual
 * sections come from the exercise record and are shown read-only around this editor.
 */
export function ReportEditor({
  reportId,
  narrative,
  readOnly,
}: {
  reportId: string;
  narrative: ReportNarrative;
  readOnly: boolean;
}) {
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(REPORT_NARRATIVE_SECTIONS.map((s) => [s.id, narrative[s.id]])),
  );
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saveState, saveAction, saving] = useActionState(
    async (previous: SaveReportState, formData: FormData) => {
      const result = await saveReportDraftAction(previous, formData);
      if (result.status === "saved") setDirty(false);
      return result;
    },
    saveInitial,
  );
  const [finalizeState, finalizeAction, finalizing] = useActionState(
    finalizeReportAction,
    finalizeInitial,
  );
  const [confirming, setConfirming] = useState(false);
  const errors = saveState.status === "invalid" ? saveState.fieldErrors : {};
  const originLabel = ORIGIN_LABEL[narrative.origin];

  return (
    <div className="space-y-6">
      {narrative.origin === "template" && !readOnly && (
        <Alert variant="destructive">
          <AlertTitle>The narrative is a template</AlertTitle>
          <AlertDescription>
            The generator was unavailable. Regenerate, or edit every section, before finalizing.
          </AlertDescription>
        </Alert>
      )}
      <form action={saveAction} className="space-y-6" data-testid="report-editor">
        <input type="hidden" name="reportId" value={reportId} />
        {REPORT_NARRATIVE_SECTIONS.map((section, index) => (
          <section
            key={section.id}
            className="space-y-3 rounded-xl border p-5"
            data-testid={`narrative-${section.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">
                <span className="mr-2 text-muted-foreground">{index + 4}.</span>
                {section.title}
              </h2>
              <div className="flex items-center gap-2">
                {originLabel && (
                  <Badge variant={narrative.origin === "template" ? "destructive" : "secondary"}>
                    {originLabel}
                  </Badge>
                )}
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={Boolean(preview[section.id])}
                    onClick={() => setPreview((p) => ({ ...p, [section.id]: !p[section.id] }))}
                  >
                    {preview[section.id] ? "Edit" : "Preview"}
                  </Button>
                )}
              </div>
            </div>
            {readOnly || preview[section.id] ? (
              <>
                <Markdown>{text[section.id]}</Markdown>
                <input type="hidden" name={section.id} value={text[section.id]} />
              </>
            ) : (
              <Textarea
                name={section.id}
                aria-label={`${section.title} (markdown)`}
                value={text[section.id]}
                maxLength={NARRATIVE_MAX_LENGTH}
                rows={8}
                className="font-mono text-sm leading-relaxed"
                onChange={(event) => {
                  setText((t) => ({ ...t, [section.id]: event.target.value }));
                  setDirty(true);
                }}
              />
            )}
            {errors[section.id] && <p className="text-sm text-destructive">{errors[section.id]}</p>}
          </section>
        ))}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? "Saving..." : "Save draft"}
            </Button>
            <p className="text-sm text-muted-foreground" role="status">
              {saveState.status === "saved"
                ? "Draft saved."
                : saveState.status === "error"
                  ? "The draft could not be saved."
                  : dirty
                    ? "Unsaved changes."
                    : ""}
            </p>
          </div>
        )}
      </form>

      {!readOnly && (
        <div className="space-y-3 rounded-xl border p-5" data-testid="finalize">
          <h2 className="text-lg font-semibold">Finalize</h2>
          <p className="text-sm text-muted-foreground">
            Finalizing renders the PDF from the exercise record and the narrative above, stores it,
            records its SHA-256, and freezes this version and the exercise&apos;s findings. Later
            corrections become an amended version; this one stays on file.
          </p>
          {dirty && <p className="text-sm text-destructive">Save the draft before finalizing.</p>}
          {!confirming ? (
            <Button
              type="button"
              size="lg"
              onClick={() => setConfirming(true)}
              disabled={dirty}
              data-testid="finalize-report"
            >
              Finalize this report
            </Button>
          ) : (
            <form action={finalizeAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="reportId" value={reportId} />
              <Button type="submit" size="lg" disabled={finalizing} data-testid="confirm-finalize">
                {finalizing ? "Rendering and storing..." : "Yes, finalize version"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={finalizing}
              >
                Not yet
              </Button>
            </form>
          )}
          {finalizeState.status === "error" && (
            <Alert variant="destructive">
              <AlertTitle>The report could not be finalized</AlertTitle>
              <AlertDescription>{finalizeState.message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
