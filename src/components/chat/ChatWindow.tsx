import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Beaker, FlaskConical, Microscope, Pill } from "lucide-react";

import logo from "@/assets/p53-logo.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { setThreadMessages } from "@/lib/threads";

const SUGGESTIONS = [
  { icon: FlaskConical, text: "Which trials are recruiting for TP53-mutant AML right now?" },
  { icon: Microscope, text: "Show p53 DNA-binding domain structures with the Y220C mutation" },
  { icon: Pill, text: "What existing approved drugs are being repurposed against mutant p53?" },
  { icon: Beaker, text: "Explain MDM2 inhibitors and where they stand clinically" },
];

const TOOL_LABEL: Record<string, string> = {
  searchClinicalTrials: "ClinicalTrials.gov",
  searchLiterature: "Europe PMC literature",
  searchStructures: "RCSB Protein Data Bank",
  searchDrugs: "openFDA drug labels",
  getP53GeneFacts: "UniProt TP53 record",
};

export function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(error.message || "The research assistant hit an error."),
  });

  useEffect(() => {
    setThreadMessages(threadId, messages);
  }, [messages, threadId]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center pt-16 text-center">
              <img src={logo} alt="P53 Atlas" width={512} height={512} className="size-16" />
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                Ask anything about TP53 / p53
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Live answers from clinical trials, published literature, protein structures and
                drug labels — scoped to one gene.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => send(text)}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-card/60 p-3 text-left text-sm text-card-foreground transition-colors hover:border-primary/50 hover:bg-card"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    const key = `${message.id}-${index}`;
                    if (part.type === "text") {
                      return <MessageResponse key={key}>{part.text}</MessageResponse>;
                    }
                    if (part.type === "reasoning" && part.text) {
                      return (
                        <details key={key} className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer select-none">Thinking</summary>
                          <p className="mt-1 whitespace-pre-wrap">{part.text}</p>
                        </details>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const toolPart = part as never as {
                        type: string;
                        state: never;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      const name = toolPart.type.replace("tool-", "");
                      return (
                        <Tool key={key} defaultOpen={false}>
                          <ToolHeader
                            type={`tool-${TOOL_LABEL[name] ?? name}` as never}
                            state={toolPart.state}
                          />
                          <ToolContent>
                            <ToolInput input={toolPart.input} />
                            <ToolOutput
                              output={
                                toolPart.output ? (
                                  <pre className="overflow-x-auto text-xs">
                                    {JSON.stringify(toolPart.output, null, 2)}
                                  </pre>
                                ) : undefined
                              }
                              errorText={toolPart.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <Shimmer className="px-1 text-sm">Searching p53 sources…</Shimmer>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <PromptInput
          onSubmit={(message, event) => {
            event.preventDefault();
            send(message.text ?? "");
            (event.currentTarget as HTMLFormElement).reset();
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Ask about TP53 trials, drugs, structures, repurposing…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={busy} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Research tool for TP53/p53 only. Not medical advice.
        </p>
      </div>
    </div>
  );
}
