// @domain personas
// @tables programme_briefings
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · The client link for the dossier.

import { useServerFn } from "@tanstack/react-start";

import { getDossierShare, setDossierShare } from "@/lib/personas/commencement-briefing.functions";
import { browserPublicOrigin, dossierLink } from "@/lib/personas/public-origin";

import { ShareBar, type ShareAction } from "./ShareBar";

export function ShareLinkBar({
  briefingId,
  canPublish,
}: {
  briefingId: string;
  canPublish: boolean;
}) {
  const readFn = useServerFn(getDossierShare);
  const writeFn = useServerFn(setDossierShare);

  return (
    <ShareBar
      label="Client link · dossier"
      createLabel="Create dossier link"
      idleCopy="Publish a single address the client can open — the dossier and the presentation, nothing else."
      liveCopy="Anyone with this address can read the dossier. No sign-in, nothing internal."
      queryKey={["dossier-share", briefingId]}
      read={() => readFn({ data: { briefingId } })}
      write={(action: ShareAction) => writeFn({ data: { briefingId, action } })}
      buildUrl={(token) => dossierLink(browserPublicOrigin(), token)}
      canPublish={canPublish}
      blockedHint="The dossier must pass its provenance check first."
    />
  );
}
