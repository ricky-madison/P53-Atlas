import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import logo from "@/assets/p53-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteThread, newThreadId, useThreads } from "@/lib/threads";

export function ThreadSidebar({ activeId }: { activeId: string }) {
  const threads = useThreads();
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src={logo} alt="" className="size-7" />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">P53 Atlas</p>
          <p className="text-[11px] text-muted-foreground">TP53 research search</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => navigate({ to: "/c/$threadId", params: { threadId: newThreadId() } })}
        >
          <Plus className="size-4" /> New chat
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
              thread.id === activeId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Link
              to="/c/$threadId"
              params={{ threadId: thread.id }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <MessageSquare className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{thread.title}</span>
            </Link>
            <button
              type="button"
              aria-label="Delete chat"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => {
                const remaining = threads.filter((t) => t.id !== thread.id);
                deleteThread(thread.id);
                if (thread.id === activeId) {
                  navigate({
                    to: "/c/$threadId",
                    params: { threadId: remaining[0]?.id ?? newThreadId() },
                  });
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </nav>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-snug text-muted-foreground">
        Chats are not saved — they clear when you reload.
      </p>
    </aside>
  );
}
