import { useSyncExternalStore } from "react";
import type { UIMessage } from "ai";

/**
 * In-memory only: the user chose not to persist chat history, so threads live
 * for the lifetime of the page session and disappear on reload.
 */
export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  messages: UIMessage[];
};

let threads: Thread[] = [];
const listeners = new Set<() => void>();

function emit() {
  threads = [...threads];
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function newThreadId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(16).slice(2)}`
  );
}

export function ensureThread(id: string) {
  if (!threads.some((t) => t.id === id)) {
    threads = [{ id, title: "New chat", createdAt: Date.now(), messages: [] }, ...threads];
    emit();
  }
}

export function setThreadMessages(id: string, messages: UIMessage[]) {
  const thread = threads.find((t) => t.id === id);
  if (!thread) return;
  thread.messages = messages;
  if (thread.title === "New chat") {
    const first = messages.find((m) => m.role === "user");
    const text = first?.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();
    if (text) thread.title = text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  emit();
}

export function deleteThread(id: string) {
  threads = threads.filter((t) => t.id !== id);
  emit();
}

export function getThread(id: string) {
  return threads.find((t) => t.id === id);
}

export function useThreads() {
  return useSyncExternalStore(
    subscribe,
    () => threads,
    () => threads,
  );
}
