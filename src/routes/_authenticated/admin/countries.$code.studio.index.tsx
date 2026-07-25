import { createFileRoute } from "@tanstack/react-router";

import { MacroFdiBoard } from "@/components/studio/MacroFdiBoard";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/studio/")({
  errorComponent: ({ error }) => (
    <p className="text-sm text-red-600">{error.message}</p>
  ),
  component: MacroBoardPage,
});

function MacroBoardPage() {
  const { code } = Route.useParams();
  return <MacroFdiBoard code={code} />;
}
