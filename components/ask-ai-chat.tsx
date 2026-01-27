"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { isTextUIPart, isDataUIPart, DefaultChatTransport } from "ai";
import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, PlayCircle, CheckCircle2, Sparkles, Trash2, Copy, X, CornerDownLeft, ArrowDown, Square } from "lucide-react";
import { useStickToBottom } from "use-stick-to-bottom";

interface AskAIChatProps {
  onClose?: () => void;
}

type MessagePart = UIMessage["parts"][number];

// Type guards
function isThinkingPart(part: MessagePart): boolean {
  return isDataUIPart(part) && part.type === "data-thinking";
}

function isSourcesPart(part: MessagePart): boolean {
  return isDataUIPart(part) && (part.type === "data-sources" || part.type === "data-complete");
}

function isStepPart(part: MessagePart): boolean {
  if (!isDataUIPart(part)) return false;
  return ["data-thinking", "data-step", "data-tool-result", "data-plan"].includes(part.type);
}

function isToolPendingPart(part: MessagePart): boolean {
  return isDataUIPart(part) && part.type === "data-tool-pending";
}

// Extract thinking data
function getThinkingContent(message: UIMessage): string | undefined {
  for (const part of message.parts) {
    if (isThinkingPart(part) && isDataUIPart(part)) {
      return (part.data as { content?: string })?.content;
    }
  }
  return undefined;
}

// Extract sources
function getSources(message: UIMessage): { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] } | undefined {
  for (const part of message.parts) {
    if (isSourcesPart(part) && isDataUIPart(part)) {
      const data = part.data as {
        sources?: { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] };
        docs?: { title: string; url: string }[];
        dictionary?: { title: string; table: string }[];
      };
      if (data.sources) return data.sources;
      if (data.docs || data.dictionary) {
        return {
          docs: data.docs || [],
          dictionary: data.dictionary || [],
        };
      }
    }
  }
  return undefined;
}

// Extract steps
function getSteps(message: UIMessage): Array<{ type: string; data: Record<string, unknown> }> {
  const steps: Array<{ type: string; data: Record<string, unknown> }> = [];
  for (const part of message.parts) {
    if (isStepPart(part) && isDataUIPart(part)) {
      steps.push({ type: part.type, data: part.data as Record<string, unknown> });
    }
  }
  return steps;
}

// Extract pending tool
function getPendingTool(message: UIMessage): {
  approvalId: string;
  toolName: string;
  toolInput: unknown;
  sources?: { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] };
} | undefined {
  for (const part of message.parts) {
    if (isToolPendingPart(part) && isDataUIPart(part)) {
      return part.data as {
        approvalId: string;
        toolName: string;
        toolInput: unknown;
        sources?: { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] };
      };
    }
  }
  return undefined;
}

// Get text content
function getTextContent(message: UIMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      text += part.text;
    }
  }
  return text;
}

function StreamingText({ content, className, isStreaming: shouldAnimate }: { content: string; className?: string; isStreaming?: boolean }) {
  // If it's the last message (shouldAnimate), start empty to allow animation.
  // Otherwise show full content immediately (history/old messages).
  const [displayedContent, setDisplayedContent] = useState(shouldAnimate ? "" : content);

  const targetContent = useRef(content);
  const currentContent = useRef(shouldAnimate ? "" : content);

  // Sync refs and handle "Snap to finish" if animation disabled
  useEffect(() => {
    targetContent.current = content;

    if (!shouldAnimate) {
      if (currentContent.current !== content) {
        currentContent.current = content;
        setDisplayedContent(content);
      }
      return;
    }

    // If we should animate, but content shrank (clear), reset
    if (content.length < currentContent.current.length) {
      currentContent.current = content;
      setDisplayedContent(content);
    }
  }, [content, shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate) return;

    let animationFrameId: number;
    const animate = () => {
      // Loop until we catch up
      if (currentContent.current.length < targetContent.current.length) {
        const diff = targetContent.current.length - currentContent.current.length;
        // Adaptive speed
        const chunk = Math.max(2, Math.ceil(diff / 20)); // Slower divisor = faster catchup. 20 is smoother.

        const nextSlice = targetContent.current.slice(0, currentContent.current.length + chunk);
        currentContent.current = nextSlice;
        setDisplayedContent(nextSlice);

        animationFrameId = requestAnimationFrame(animate);
      }
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [shouldAnimate, content]); // Dep on content to restart loop if new data comes

  return (
    <div className={className}>
      {displayedContent}
    </div>
  );
}

function SparklesIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      height={size}
      strokeLinejoin="round"
      style={{ color: "currentcolor" }}
      viewBox="0 0 16 16"
      width={size}
      className={className}
    >
      <path
        d="M2.5 0.5V0H3.5V0.5C3.5 1.60457 4.39543 2.5 5.5 2.5H6V3V3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V6H3H2.5V5.5C2.5 4.39543 1.60457 3.5 0.5 3.5H0V3V2.5H0.5C1.60457 2.5 2.5 1.60457 2.5 0.5Z"
        fill="currentColor"
      />
      <path
        d="M14.5 4.5V5H13.5V4.5C13.5 3.94772 13.0523 3.5 12.5 3.5H12V3V2.5H12.5C13.0523 2.5 13.5 2.05228 13.5 1.5V1H14H14.5V1.5C14.5 2.05228 14.9477 2.5 15.5 2.5H16V3V3.5H15.5C14.9477 3.5 14.5 3.94772 14.5 4.5Z"
        fill="currentColor"
      />
      <path
        d="M8.40706 4.92939L8.5 4H9.5L9.59294 4.92939C9.82973 7.29734 11.7027 9.17027 14.0706 9.40706L15 9.5V10.5L14.0706 10.5929C11.7027 10.8297 9.82973 12.7027 9.59294 15.0706L9.5 16H8.5L8.40706 15.0706C8.17027 12.7027 6.29734 10.8297 3.92939 10.5929L3 10.5V9.5L3.92939 9.40706C6.29734 9.17027 8.17027 7.29734 8.40706 4.92939Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Thinking({ thought }: { thought?: string }) {
  return (
    <div className="flex items-start justify-start gap-3 py-4">
      <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-gray-200">
        <div className="animate-pulse">
          <SparklesIcon size={14} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 md:gap-4">
        <div className="flex items-center gap-1 p-0 text-gray-500 text-[13px]">
          <span className="animate-pulse font-medium">Thinking</span>
          <span className="inline-flex">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
          {thought && (
            <span className="text-gray-400 text-xs ml-2">({thought})</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: Array<{ type: string; data: Record<string, unknown> }> }) {
  const [isOpen, setIsOpen] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden mb-2 bg-gray-50/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>Process Steps ({steps.length})</span>
        </div>
        {!isOpen && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100/80 text-[10px]">
            <PlayCircle className="w-2.5 h-2.5 text-blue-500" />
            <span>View</span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-gray-100/50">
          {steps.map((step, idx) => {
            const currentTimestamp = (step.data as any).timestamp as number | undefined;
            const nextStep = steps[idx + 1];
            const nextTimestamp = (nextStep?.data as any)?.timestamp as number | undefined;

            let duration = "";
            if (currentTimestamp && nextTimestamp) {
              const diff = nextTimestamp - currentTimestamp;
              if (diff > 0) {
                duration = `${(diff / 1000).toFixed(1)}s`;
              }
            }

            if (step.type === "data-thinking") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2.5 pl-1 justify-between group">
                  <div className="flex items-start gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <span className="italic leading-relaxed">{(step.data as { content?: string }).content}</span>
                  </div>
                  {duration && <span className="text-[10px] text-gray-400 font-mono shrink-0">{duration}</span>}
                </div>
              );
            }
            if (step.type === "data-step") {
              const stepData = step.data as { step?: { type?: string; toolName?: string } };
              return (
                <div key={idx} className="text-[11px] text-gray-700 flex items-center gap-2.5 pl-1 justify-between group">
                  <div className="flex items-center gap-2.5">
                    <PlayCircle className="w-3 h-3 text-blue-500 shrink-0" />
                    <span className="font-mono bg-white px-1 rounded border border-gray-100">Step: {stepData.step?.toolName || stepData.step?.type}</span>
                  </div>
                  {duration && <span className="text-[10px] text-gray-400 font-mono shrink-0">{duration}</span>}
                </div>
              );
            }
            if (step.type === "data-tool-result") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2.5 pl-1 opacity-75">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span>Tool Execution Completed</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// Custom transport that extends DefaultChatTransport
class AskAIChatTransport extends DefaultChatTransport<UIMessage> {
  constructor() {
    super({
      api: "/api/ask-ai",
      body: { agentic: true },
      prepareSendMessagesRequest: async ({ messages }) => {
        return {
          body: {
            messages: messages.map(m => ({
              role: m.role,
              content: m.parts
                .filter(p => isTextUIPart(p))
                .map(p => (p as { text: string }).text)
                .join(""),
            })),
            agentic: true,
          },
        };
      },
    });
  }
}

export function AskAIChat({ onClose }: AskAIChatProps) {
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, { status: "pending" | "approved" | "rejected" }>>(new Map());
  const [input, setInput] = useState("");

  const transport = useMemo(() => new AskAIChatTransport(), []);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: "ask-ai-chat",
    transport,
  });

  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

  const isLoading = status === "streaming" || status === "submitted";

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    await sendMessage({ text: message });
  }

  async function approve(approvalId: string, toolName: string, toolInput: unknown) {
    setPendingApprovals(prev => new Map(prev).set(approvalId, { status: "approved" }));

    const res = await fetch("/api/tools/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId }),
    });

    const data = await res.json();

    if (!data.ok) {
      await sendMessage({
        text: `❌ Tool error: ${data.error}`
      });
      return;
    }

    // Send follow-up message with tool result
    await sendMessage({
      text: `ช่วยสรุปผลจาก Tool Output:\n${JSON.stringify(data.result, null, 2)}`,
    });
  }

  async function reject(approvalId: string) {
    await fetch("/api/tools/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId }),
    });

    setPendingApprovals(prev => new Map(prev).set(approvalId, { status: "rejected" }));
  }

  function clearChat() {
    setMessages([]);
    setPendingApprovals(new Map());
  }

  return (
    <aside className="shrink-0 z-50 sticky h-screen top-0 right-0">
      <div className="w-full h-full">
        <div className="border-l border-gray-200 overflow-hidden justify-end h-screen flex flex-col whitespace-nowrap bg-white">
          {/* Header */}
          <div className="flex items-center justify-between pl-4 pr-3 py-2 sticky top-0 bg-white/80 backdrop-blur-sm h-14 z-20 border-b border-gray-100">
            <h2 className="font-bold text-[13px] text-gray-900 flex items-center gap-2">
              Chat
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Copy chat as markdown"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                title="Copy chat"
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Clear chat"
                onClick={clearChat}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                title="Clear all"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                title="Close"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="relative overflow-y-auto flex-1 scrollbar-hide"
            role="log"
          >
            <div ref={contentRef} className="p-4">
              {messages.length === 0 && (
                <div className="flex flex-col justify-end h-full min-h-[400px] p-4 space-y-6">
                  <div className="space-y-3">
                    {[
                      "What is Chat SDK?",
                      "How does Chat SDK work?",
                      "How can I customize Chat SDK?",
                      "How do I deploy Chat SDK?",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage({ text: q })}
                        className="block text-[#006cff] text-[13px] font-medium hover:underline text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                    <span>Tip: You can open and close chat with</span>
                    <span className="flex items-center gap-0.5 px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-[9px]">
                      <span className="text-[10px]">⌘</span>
                      <span>I</span>
                    </span>
                  </div>
                </div>
              )}

              {messages.map((m) => {
                if (m.role === "user") {
                  const content = getTextContent(m);
                  return (
                    <div key={m.id} className="group flex w-full items-start justify-end gap-3 py-4">
                      <div className="relative flex flex-col gap-2 rounded-2xl px-4 py-2.5 text-[13px] bg-blue-600 text-white max-w-[85%] shadow-sm">
                        <div className="whitespace-pre-wrap leading-6">{content}</div>
                      </div>
                    </div>
                  );
                }

                if (m.role === "assistant") {
                  const content = getTextContent(m);
                  const steps = getSteps(m);
                  const sources = getSources(m);
                  const pendingTool = getPendingTool(m);

                  return (
                    <div key={m.id} className="group flex w-full items-start justify-start gap-2 py-5">
                      <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-gray-200">
                        <SparklesIcon size={14} />
                      </div>

                      <div className="flex w-full flex-col min-w-0">
                        <Steps steps={steps} />

                        {/* Pending Tool Approval */}
                        {pendingTool && (
                          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-3 shadow-sm my-4">
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Action Required: {pendingTool.toolName}
                            </div>
                            <pre className="text-[11px] bg-white border border-amber-100 p-2 rounded max-h-32 overflow-auto font-mono whitespace-pre-wrap">
                              {JSON.stringify(pendingTool.toolInput, null, 2)}
                            </pre>
                            {(() => {
                              const approvalStatus = pendingApprovals.get(pendingTool.approvalId)?.status || "pending";
                              if (approvalStatus === "pending") {
                                return (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => approve(pendingTool.approvalId, pendingTool.toolName, pendingTool.toolInput)}
                                      disabled={isLoading}
                                      className="flex-1 bg-white border border-gray-200 py-1.5 rounded text-xs font-medium hover:bg-gray-50 shadow-sm"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => reject(pendingTool.approvalId)}
                                      disabled={isLoading}
                                      className="flex-1 bg-white border border-gray-200 py-1.5 rounded text-xs font-medium hover:bg-gray-50 shadow-sm text-red-600"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <div className={`text-[11px] font-medium ${approvalStatus === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                  {approvalStatus === "approved" ? "✓ Request Approved" : "✕ Request Rejected"}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {!content && steps.length === 0 && isLoading && m.id === messages[messages.length - 1].id && (
                          <div className="flex items-center gap-1 text-gray-500 text-[13px] py-1">
                            <span className="animate-pulse font-medium">Thinking</span>
                            <span className="inline-flex">
                              <span className="animate-bounce [animation-delay:0ms]">.</span>
                              <span className="animate-bounce [animation-delay:150ms]">.</span>
                              <span className="animate-bounce [animation-delay:300ms]">.</span>
                            </span>
                          </div>
                        )}

                        {content && (
                          <StreamingText
                            content={content}
                            isStreaming={m.id === messages[messages.length - 1].id}
                            className="whitespace-pre-wrap leading-7 text-gray-800 text-[14px]"
                          />
                        )}

                        {sources && (sources.docs.length > 0 || sources.dictionary.length > 0) && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              ที่มาของข้อมูล
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sources.docs.map((doc, dIdx) => (
                                <a
                                  key={dIdx}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100 hover:bg-blue-100 transition-colors"
                                >
                                  {doc.title}
                                </a>
                              ))}
                              {sources.dictionary.map((dict, dIdx) => (
                                <span
                                  key={dIdx}
                                  title={dict.title}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-100"
                                >
                                  DB: {dict.table}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Feedback buttons - only show if there is content */}
                        {content && content.trim().length > 0 && (
                          <div className="mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors" aria-label="Thumb up">
                              <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.89531 2.23972C6.72984 2.12153 6.5 2.23981 6.5 2.44315V5.25001C6.5 6.21651 5.7165 7.00001 4.75 7.00001H2.5V13.5H12.1884C12.762 13.5 13.262 13.1096 13.4011 12.5532L14.4011 8.55318C14.5984 7.76425 14.0017 7.00001 13.1884 7.00001H9.25H8.5V6.25001V3.51458C8.5 3.43384 8.46101 3.35807 8.39531 3.31114L6.89531 2.23972ZM5 2.44315C5 1.01975 6.6089 0.191779 7.76717 1.01912L9.26717 2.09054C9.72706 2.41904 10 2.94941 10 3.51458V5.50001H13.1884C14.9775 5.50001 16.2903 7.18133 15.8563 8.91698L14.8563 12.917C14.5503 14.1412 13.4503 15 12.1884 15H1.75H1V14.25V6.25001V5.50001H1.75H4.75C4.88807 5.50001 5 5.38808 5 5.25001V2.44315Z" />
                              </svg>
                            </button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors" aria-label="Thumb down">
                              <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.89531 13.7603C6.72984 13.8785 6.5 13.7602 6.5 13.5569V10.75C6.5 9.7835 5.7165 9 4.75 9H2.5V2.5H12.1884C12.762 2.5 13.262 2.89037 13.4011 3.44683L14.4011 7.44683C14.5984 8.23576 14.0017 9 13.1884 9H9.25H8.5V9.75V12.4854C8.5 12.5662 8.46101 12.6419 8.39531 12.6889L6.89531 13.7603ZM5 13.5569C5 14.9803 6.6089 15.8082 7.76717 14.9809L9.26717 13.9095C9.72706 13.581 10 13.0506 10 12.4854V10.5H13.1884C14.9775 10.5 16.2903 8.81868 15.8563 7.08303L14.8563 3.08303C14.5503 1.85882 13.4503 1 12.1884 1H1.75H1V1.75V9.75V10.5H1.75H4.75C4.88807 10.5 5 10.6119 5 10.75V13.5569Z" />
                              </svg>
                            </button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors" aria-label="Copy">
                              <Copy className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="py-4">
                  <Thinking />
                </div>
              )}
            </div>
          </div>

          <div className="relative p-4 bg-white">
            {/* Scroll to bottom button */}
            {!isAtBottom && (
              <button
                onClick={() => scrollToBottom()}
                className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 p-2 rounded-full bg-gray-900/90 shadow-lg text-white hover:bg-gray-800 transition-all animate-in fade-in zoom-in"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}

            <div className="relative flex flex-col w-full bg-white border border-gray-200 rounded-xl transition-all duration-200 shadow-sm focus-within:border-gray-400">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !isLoading) handleSubmit();
                    }
                  }}
                  placeholder="What would you like to know?"
                  className="w-full bg-transparent p-4 pb-14 text-[13px] resize-none outline-none placeholder:text-gray-400 min-h-[120px]"
                  disabled={isLoading}
                />
                <div className="absolute bottom-3 left-4 text-[11px] text-gray-400">
                  {input.length} / 1000
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={() => stop()}
                      aria-label="Stop generating"
                      className="flex items-center justify-center size-8 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm animate-in fade-in zoom-in duration-200"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      aria-label="Submit"
                      className="flex items-center justify-center size-8 rounded-lg bg-[#006cff] text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all hover:bg-blue-700 shadow-sm"
                    >
                      <CornerDownLeft className="size-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
