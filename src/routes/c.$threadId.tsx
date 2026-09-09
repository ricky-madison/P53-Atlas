import { createFileRoute } from "@tanstack/react-router";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { ensureThread, getThread } from "@/lib/threads";

export const Route = createFileRoute("/c/$threadId")({
  head: () => ({
    meta: [
      { title: "P53 Atlas — TP53 research chat" },
      {
        name: "description",
        content:
          "Chat with a TP53/p53 research assistant that searches clinical trials, literature, protein structures and drug labels live.",
      },
      { property: "og:title", content: "P53 Atlas — TP53 research chat" },
      {
        property: "og:description",
        content:
          "Ask about p53 treatments, trials, structures, drugs and repurposing, backed by live scientific sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  ensureThread(threadId);
  const thread = getThread(threadId);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ThreadSidebar activeId={threadId} />
      <ChatWindow key={threadId} threadId={threadId} initialMessages={thread?.messages ?? []} />
    </div>
  );
}
