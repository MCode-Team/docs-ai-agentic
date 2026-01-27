"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { isTextUIPart, isDataUIPart, DefaultChatTransport } from "ai";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, PlayCircle, CheckCircle2, BrainCircuit } from "lucide-react";

interface AskAIChatProps {
  onClose?: () => void;
}

type MessagePart = UIMessage["parts"][number];

// Type guards with proper types
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

// Extract thinking data from message parts
function getThinkingContent(message: UIMessage): string | undefined {
  for (const part of message.parts) {
    if (isThinkingPart(part) && isDataUIPart(part)) {
      return (part.data as { content?: string })?.content;
    }
  }
  return undefined;
}

// Extract sources from message parts
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

// Extract steps/events from message parts
function getSteps(message: UIMessage): Array<{ type: string; data: Record<string, unknown> }> {
  const steps: Array<{ type: string; data: Record<string, unknown> }> = [];
  for (const part of message.parts) {
    if (isStepPart(part) && isDataUIPart(part)) {
      steps.push({ type: part.type, data: part.data as Record<string, unknown> });
    }
  }
  return steps;
}

// Extract pending tool approval from message parts
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

// Get text content from message
function getTextContent(message: UIMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (isTextUIPart(part)) {
      text += part.text;
    }
  }
  return text;
}

function Thinking({ thought }: { thought?: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse p-2">
      <BrainCircuit className="w-4 h-4" />
      <span className="font-medium text-xs">Thinking... {thought && <span className="font-normal text-gray-400">({thought})</span>}</span>
    </div>
  );
}

function Steps({ steps }: { steps: Array<{ type: string; data: Record<string, unknown> }> }) {
  const [isOpen, setIsOpen] = useState(true);

  if (steps.length === 0) return null;

  return (
    <div className="bg-gray-50/50 rounded-lg border border-gray-100 overflow-hidden mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>Process Steps ({steps.length})</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-0 space-y-2">
          {steps.map((step, idx) => {
            if (step.type === "data-thinking") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2 pl-1">
                  <BrainCircuit className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                  <span className="italic">{(step.data as { content?: string }).content}</span>
                </div>
              );
            }
            if (step.type === "data-step") {
              const stepData = step.data as { step?: { type?: string; toolName?: string } };
              return (
                <div key={idx} className="text-[11px] text-gray-700 flex items-center gap-2 pl-1">
                  <PlayCircle className="w-3 h-3 text-blue-500 shrink-0" />
                  <span className="font-mono">Step: {stepData.step?.toolName || stepData.step?.type}</span>
                </div>
              );
            }
            if (step.type === "data-tool-result") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2 pl-1 opacity-75">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                  <span>Tool Completed</span>
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

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "ask-ai-chat",
    transport,
  });

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
          <div className="flex items-center justify-between pl-4 pr-2 py-2 sticky top-0 bg-white h-16 z-10 border-b border-gray-100">
            <h2 className="font-semibold text-sm text-gray-900">Ask AI</h2>
            <div className="flex items-center gap-0.5">
              {/* Copy button */}
              <button
                type="button"
                aria-label="Copy chat as markdown"
                className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                  <path fillRule="evenodd" d="M2.75.5C1.78.5 1 1.28 1 2.25v7.5c0 .97.78 1.75 1.75 1.75H4.5V10H2.75a.25.25 0 0 1-.25-.25v-7.5c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25V3H10v-.75C10 1.28 9.22.5 8.25.5zm5 4C6.78 4.5 6 5.28 6 6.25v7.5c0 .97.78 1.75 1.75 1.75h5.5c.97 0 1.75-.78 1.75-1.75v-7.5c0-.97-.78-1.75-1.75-1.75zM7.5 6.25c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25v7.5q-.02.23-.25.25h-5.5a.25.25 0 0 1-.25-.25z" clipRule="evenodd" />
                </svg>
              </button>
              {/* Share button */}
              <button
                type="button"
                aria-label="Share chat"
                className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M7.29289 1.39644C7.68342 1.00592 8.31658 1.00592 8.70711 1.39644L11.7803 4.46966L12.3107 4.99999L11.25 6.06065L10.7197 5.53032L8.75 3.56065V10.25V11H7.25V10.25V3.56065L5.28033 5.53032L4.75 6.06065L3.68934 4.99999L4.21967 4.46966L7.29289 1.39644ZM13.5 9.24999V13.5H2.5V9.24999V8.49999H1V9.24999V14C1 14.5523 1.44771 15 2 15H14C14.5523 15 15 14.5523 15 14V9.24999V8.49999H13.5V9.24999Z" />
                </svg>
              </button>
              {/* Clear button */}
              <button
                type="button"
                aria-label="Clear chat"
                onClick={clearChat}
                className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.75 2.75C6.75 2.05964 7.30964 1.5 8 1.5C8.69036 1.5 9.25 2.05964 9.25 2.75V3H6.75V2.75ZM5.25 3V2.75C5.25 1.23122 6.48122 0 8 0C9.51878 0 10.75 1.23122 10.75 2.75V3H12.9201H14.25H15V4.5H14.25H13.8846L13.1776 13.6917C13.0774 14.9942 11.9913 16 10.6849 16H5.31508C4.00874 16 2.92263 14.9942 2.82244 13.6917L2.11538 4.5H1.75H1V3H1.75H3.07988H5.25ZM4.31802 13.5767L3.61982 4.5H12.3802L11.682 13.5767C11.6419 14.0977 11.2075 14.5 10.6849 14.5H5.31508C4.79254 14.5 4.3581 14.0977 4.31802 13.5767Z" />
                </svg>
              </button>
              {/* Close button */}
              <button
                type="button"
                aria-label="Close chat"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 16 16" height="14" width="14" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.8536 8.7071C13.2441 8.31657 13.2441 7.68341 12.8536 7.29288L9.03034 3.46966L8.50001 2.93933L7.43935 3.99999L7.96968 4.53032L11.4393 7.99999L7.96968 11.4697L7.43935 12L8.50001 13.0607L9.03034 12.5303L12.8536 8.7071ZM7.85356 8.7071C8.24408 8.31657 8.24408 7.68341 7.85356 7.29288L4.03034 3.46966L3.50001 2.93933L2.43935 3.99999L2.96968 4.53032L6.43935 7.99999L2.96968 11.4697L2.43935 12L3.50001 13.0607L4.03034 12.5303L7.85356 8.7071Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="relative overflow-y-auto flex-1 scrollbar-hide" role="log">
            <div className="p-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8 space-y-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Vercel AI Agent</p>
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal">Ask questions about your project, documentation, or code.</p>
                  </div>
                </div>
              )}

              {messages.map((m) => {
                if (m.role === "user") {
                  const content = getTextContent(m);
                  return (
                    <div key={m.id} className="group flex w-full items-end justify-end gap-4 py-4">
                      <div className="relative flex flex-col gap-2 rounded-xl px-4 py-2 text-sm min-h-[40px] bg-gray-900 text-white max-w-[80%]">
                        <div className="whitespace-pre-wrap leading-6">{content}</div>
                        {/* Speech bubble tail */}
                        <svg width="18" height="14" viewBox="0 0 18 14" className="absolute -bottom-[0.5px] right-[2.5px] translate-x-1/2 fill-gray-900">
                          <path d="M0.866025 8.80383L11.2583 0.803833C11.2583 0.803833 12.0621 9.5 17.2583 13.1961C12.0621 13.1961 0.866025 8.80383 0.866025 8.80383Z" />
                        </svg>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-linear-to-tr from-teal-400 to-cyan-500 shrink-0 mt-2" />
                    </div>
                  );
                }

                if (m.role === "assistant") {
                  const content = getTextContent(m);
                  const steps = getSteps(m);
                  const sources = getSources(m);
                  const pendingTool = getPendingTool(m);

                  return (
                    <div key={m.id} className="max-w-[95%] text-sm leading-relaxed py-4">
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

                      <div className="whitespace-pre-wrap leading-6 text-gray-800">{content}</div>

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
                        <div className="mt-2 flex items-center gap-0.5">
                          <div className="flex items-center gap-0.5">
                            <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors" aria-label="Thumb up">
                              <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor">
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.89531 2.23972C6.72984 2.12153 6.5 2.23981 6.5 2.44315V5.25001C6.5 6.21651 5.7165 7.00001 4.75 7.00001H2.5V13.5H12.1884C12.762 13.5 13.262 13.1096 13.4011 12.5532L14.4011 8.55318C14.5984 7.76425 14.0017 7.00001 13.1884 7.00001H9.25H8.5V6.25001V3.51458C8.5 3.43384 8.46101 3.35807 8.39531 3.31114L6.89531 2.23972ZM5 2.44315C5 1.01975 6.6089 0.191779 7.76717 1.01912L9.26717 2.09054C9.72706 2.41904 10 2.94941 10 3.51458V5.50001H13.1884C14.9775 5.50001 16.2903 7.18133 15.8563 8.91698L14.8563 12.917C14.5503 14.1412 13.4503 15 12.1884 15H1.75H1V14.25V6.25001V5.50001H1.75H4.75C4.88807 5.50001 5 5.38808 5 5.25001V2.44315Z" />
                              </svg>
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors" aria-label="Thumb down">
                              <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor">
                                <path fillRule="evenodd" clipRule="evenodd" d="M6.89531 13.7603C6.72984 13.8785 6.5 13.7602 6.5 13.5569V10.75C6.5 9.7835 5.7165 9 4.75 9H2.5V2.5H12.1884C12.762 2.5 13.262 2.89037 13.4011 3.44683L14.4011 7.44683C14.5984 8.23576 14.0017 9 13.1884 9H9.25H8.5V9.75V12.4854C8.5 12.5662 8.46101 12.6419 8.39531 12.6889L6.89531 13.7603ZM5 13.5569C5 14.9803 6.6089 15.8082 7.76717 14.9809L9.26717 13.9095C9.72706 13.581 10 13.0506 10 12.4854V10.5H13.1884C14.9775 10.5 16.2903 8.81868 15.8563 7.08303L14.8563 3.08303C14.5503 1.85882 13.4503 1 12.1884 1H1.75H1V1.75V9.75V10.5H1.75H4.75C4.88807 10.5 5 10.6119 5 10.75V13.5569Z" />
                              </svg>
                            </button>
                          </div>
                          <button className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors" aria-label="Copy">
                            <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor">
                              <path fillRule="evenodd" d="M2.75.5C1.78.5 1 1.28 1 2.25v7.5c0 .97.78 1.75 1.75 1.75H4.5V10H2.75a.25.25 0 0 1-.25-.25v-7.5c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25V3H10v-.75C10 1.28 9.22.5 8.25.5zm5 4C6.78 4.5 6 5.28 6 6.25v7.5c0 .97.78 1.75 1.75 1.75h5.5c.97 0 1.75-.78 1.75-1.75v-7.5c0-.97-.78-1.75-1.75-1.75zM7.5 6.25c0-.14.11-.25.25-.25h5.5c.14 0 .25.11.25.25v7.5q-.02.23-.25.25h-5.5a.25.25 0 0 1-.25-.25z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {isLoading && (
                <div className="py-4">
                  <Thinking thought={(() => {
                    const last = messages[messages.length - 1];
                    return last?.role === "assistant" ? getThinkingContent(last) : undefined;
                  })()} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4">
            <div className="pb-2 pt-2 cursor-text border border-gray-300 rounded-xl shadow-sm focus-within:border-gray-500 transition-colors duration-250">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col items-center gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask a question..."
                  className="flex bg-transparent py-2 text-sm w-full resize-none rounded-none shadow-none outline-none ring-0 min-h-0 placeholder:text-gray-500 focus-visible:ring-0 px-4"
                  style={{ height: '56px' }}
                  disabled={isLoading}
                />
                <div className="items-center w-full px-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    aria-label="Submit"
                    className="p-2 rounded-md bg-gray-900 text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.70711 1.39644C8.31659 1.00592 7.68342 1.00592 7.2929 1.39644L2.21968 6.46966L1.68935 6.99999L2.75001 8.06065L3.28034 7.53032L7.25001 3.56065V14.25V15H8.75001V14.25V3.56065L12.7197 7.53032L13.25 8.06065L14.3107 6.99999L13.7803 6.46966L8.70711 1.39644Z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
