// @domain personas
// @tables programme_decks
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · The client link for the presentation, alongside the dossier's.

import { useServerFn } from "@tanstack/react-start";

import { getDeckShare, setDeckShare } from "@/lib/personas/programme-deck.functions";
import { browserPublicOrigin, deckLink } from "@/lib/personas/public-origin";

import { ShareBar, type ShareAction } from "./ShareBar";

export function DeckShareLinkBar({
  projectId,
  canPublish,
}: {
  projectId: string;
  canPublish: boolean;
}) {
  const readFn = useServerFn(getDeckShare);
  const writeFn = useServerFn(setDeckShare);

  return (
    <ShareBar
      label="Client link · presentation"
      createLabel="Create presentation link"
      idleCopy="Publish a separate address that opens the presentation on its own — view, present, print or download."
      liveCopy="Anyone with this address can open the presentation. No sign-in, nothing internal."
      queryKey={["deck-share", projectId]}
      read={() => readFn({ data: { projectId } })}
      write={(action: ShareAction) => writeFn({ data: { projectId, action } })}
      buildUrl={(token) => deckLink(browserPublicOrigin(), token)}
      canPublish={canPublish}
      blockedHint="Prepare the presentation from a clean dossier first."
    />
  );
}
