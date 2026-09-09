import { createFileRoute, redirect } from "@tanstack/react-router";

import { newThreadId } from "@/lib/threads";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/c/$threadId", params: { threadId: newThreadId() } });
  },
  component: () => null,
});
