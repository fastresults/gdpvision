// The value calculator moved to /business-case/brief (the Decision Brief,
// value model v2). Old links keep working.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/business-case_/calculator")({
  beforeLoad: () => {
    throw redirect({ to: "/business-case/brief", search: {} });
  },
  component: () => null,
});
