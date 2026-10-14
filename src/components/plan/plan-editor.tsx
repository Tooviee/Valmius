"use client";

import { useActionState, useEffect, useState } from "react";
import { Markdown } from "@/components/plan/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SECTION_MARKDOWN_MAX_LENGTH,
  type PlanSection,
  type PlanSectionId,
  type PlanSections,
} from "@/lib/schemas/plan";
import { regenerateSectionAction, savePlanVersionAction } from "@/server/actions/plan";
import type { RegenerateSectionState, SavePlanState } from "@/server/actions/types";

const ORIGIN_LABELS: Record<PlanSection["origin"], string | null> = {
  model: null,
  matrix: "Built from your answers",
  template: "Template: needs review",
  user: "Edited",
};

const regenerateInitial: RegenerateSectionState = { status: "idle" };
const saveInitial: SavePlanState = { status: "idle" };

function SectionCard({
  section,
  number,
  readOnly,
  onChange,
  onReplace,
}: {
  section: PlanSection;
  number: number;
  readOnly: boolean;
  onChange: (id: PlanSectionId, markdown: string) => void;
  onReplace: (section: PlanSection) => void;
}) {
  const [preview, setPreview] = useState(readOnly);
  const [state, formAction, pending] = useActionState(regenerateSectionAction, regenerateInitial);

  useEffect(() => {
    if (state.status === "ok") onReplace(state.section);
  }, [state, onReplace]);

  const originLabel = ORIGIN_LABELS[section.origin];

  return (
    <section
      className="space-y-4 rounded-xl border p-5"
      data-testid="plan-section"
      data-section-id={section.id}
      aria-labelledby={`section-${section.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={`section-${section.id}`} className="text-lg font-semibold">
            <span className="mr-2 text-muted-foreground">{number}.</span>
            {section.title}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {originLabel && (
              <Badge variant={section.origin === "template" ? "destructive" : "secondary"}>
                {originLabel}
              </Badge>
            )}
            {section.framework_refs.map((ref) => (
              <Badge key={ref} variant="outline">
                {ref}
              </Badge>
            ))}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={preview}
              onClick={() => setPreview((value) => !value)}
            >
              {preview ? "Edit" : "Preview"}
            </Button>
            <form action={formAction}>
              <input type="hidden" name="sectionId" value={section.id} />
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                {pending ? "Rewriting..." : "Regenerate this section"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {section.origin === "template" && !readOnly && (
        <Alert variant="destructive">
          <AlertTitle>This section is a template</AlertTitle>
          <AlertDescription>
            The generator was unavailable when the plan was written. Regenerate it, or edit the
            text, before approving the plan.
          </AlertDescription>
        </Alert>
      )}
      {state.status === "rate_limited" && (
        <Alert>
          <AlertTitle>Rewrite limit reached</AlertTitle>
          <AlertDescription>
            Up to 30 section rewrites an hour. Edit the text instead.
          </AlertDescription>
        </Alert>
      )}
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>The section could not be rewritten</AlertTitle>
          <AlertDescription>Please try again in a moment.</AlertDescription>
        </Alert>
      )}

      {preview || readOnly ? (
        <Markdown>{section.markdown}</Markdown>
      ) : (
        <Textarea
          aria-label={`${section.title} (markdown)`}
          value={section.markdown}
          onChange={(event) => onChange(section.id, event.target.value)}
          maxLength={SECTION_MARKDOWN_MAX_LENGTH}
          rows={12}
          className="font-mono text-sm leading-relaxed"
        />
      )}
    </section>
  );
}

/**
 * The per-section editor (SPEC.md section 7, Phase 2). Edits live in the browser until
 * "Save as new version"; an approved version is shown read-only.
 */
export function PlanEditor({
  planId,
  sections: initialSections,
  readOnly,
}: {
  planId: string;
  sections: PlanSections;
  readOnly: boolean;
}) {
  const [sections, setSections] = useState<PlanSection[]>(initialSections);
  const [dirty, setDirty] = useState(false);
  const [saveState, saveAction, saving] = useActionState(savePlanVersionAction, saveInitial);

  const onChange = (id: PlanSectionId, markdown: string) => {
    setSections((current) => current.map((s) => (s.id === id ? { ...s, markdown } : s)));
    setDirty(true);
  };
  const onReplace = (section: PlanSection) => {
    setSections((current) => current.map((s) => (s.id === section.id ? section : s)));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          number={index + 1}
          readOnly={readOnly}
          onChange={onChange}
          onReplace={onReplace}
        />
      ))}

      <form action={saveAction} className="sticky bottom-0 border-t bg-background py-4">
        <input type="hidden" name="basePlanId" value={planId} />
        <input type="hidden" name="sections" value={JSON.stringify(sections)} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "This version is approved and cannot be changed. Start a new draft to edit it."
              : dirty
                ? "You have unsaved changes. Saving creates a new version; nothing is overwritten."
                : "Edit any section, or regenerate one. Saving creates a new version."}
          </p>
          <Button type="submit" disabled={saving || (!readOnly && !dirty)}>
            {saving
              ? "Saving..."
              : readOnly
                ? "Start a new draft from this version"
                : "Save as new version"}
          </Button>
        </div>
        {saveState.status === "invalid" && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            The plan could not be saved: every section needs some text and valid framework
            references.
          </p>
        )}
      </form>
    </div>
  );
}
