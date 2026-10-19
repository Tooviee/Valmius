import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/logo";
import { ParticipantView } from "@/components/exercise/participant-view";
import { Poller } from "@/components/exercise/poller";
import { loadParticipantView } from "@/lib/exercise/participant";

export const metadata: Metadata = {
  title: "Tabletop exercise",
  robots: { index: false, follow: false },
};

/**
 * The participant's page (SPEC.md section 7, Phase 3). No account: the link is the
 * credential. Polls every five seconds while the exercise is live.
 */
export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadParticipantView(token);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-6">
          <Wordmark />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 outline-none"
      >
        {view ? (
          <>
            <Poller
              intervalMs={5_000}
              enabled={view.exercise.status !== "reported" && !view.participant.signed_off_at}
            />
            <ParticipantView view={view} token={token} />
          </>
        ) : (
          <div className="space-y-2" data-testid="invalid-link">
            <h1 className="font-display text-3xl font-medium tracking-tight">
              This link is not valid
            </h1>
            <p className="text-muted-foreground">
              It may have expired (links stop working 30 days after an exercise ends) or been copied
              incompletely. Ask the facilitator for a new one.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
