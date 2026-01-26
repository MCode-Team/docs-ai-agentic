"use client";

import { useState, useRef, useEffect } from "react";
import { type AgentEvent, type PlanStep } from "@/lib/agent/types";
import { ChevronDown, ChevronRight, Loader2, PlayCircle, CheckCircle2, BrainCircuit } from "lucide-react";


type Msg =
  | { role: "user"; content: string }
  | {
    role: "assistant";
    content: string;
    sources?: { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] };
    events?: AgentEvent[];
  }
  | { role: "tool"; toolName: string; content: string }
  | {
    role: "approval";
    approvalId: string;
    toolName: string;
    input: any;
    postToolMessage: string;
    status: "pending" | "approved" | "rejected";
    sources?: { docs: { title: string; url: string }[]; dictionary: { title: string; table: string }[] };
  };

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm animate-pulse p-2">
      <BrainCircuit className="w-4 h-4" />
      <span className="font-medium text-xs">Thinking...</span>
    </div>
  );
}

function Steps({ events }: { events?: AgentEvent[] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!events || events.length === 0) return null;

  // Filter relevant events to show as steps
  const steps = events.filter(e =>
    e.type === "thinking" ||
    e.type === "tool_pending" ||
    e.type === "tool_result" ||
    (e.type === "step_started" && e.step?.type === "tool")
  );

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
          {steps.map((evt, idx) => {
            if (evt.type === "thinking") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2 pl-1">
                  <BrainCircuit className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                  <span className="italic">{evt.content}</span>
                </div>
              );
            }
            if (evt.type === "step_started" && evt.step?.type === "tool") {
              return (
                <div key={idx} className="text-[11px] text-gray-700 flex items-center gap-2 pl-1">
                  <PlayCircle className="w-3 h-3 text-blue-500 shrink-0" />
                  <span className="font-mono">Call: {evt.step.toolName}</span>
                </div>
              );
            }
            if (evt.type === "tool_result") {
              return (
                <div key={idx} className="text-[11px] text-gray-600 flex items-start gap-2 pl-1 opacity-75">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                  <span>Tool Completed</span>
                </div>
              );
            }
            if (evt.type === "tool_pending") {
              return (
                <div key={idx} className="text-[11px] text-amber-600 flex items-center gap-2 pl-1">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Waiting for approval: {evt.toolName}</span>
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

interface AskAIChatProps {
  onClose?: () => void;
}

export function AskAIChat({ onClose }: AskAIChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function callAskAI(nextMsgs: any[]) {
    const res = await fetch("/api/ask-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMsgs }),
    });
    return res.json();
  }

  async function send(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    const nextMsgs = [...messages, { role: "user", content: text } as Msg];
    setMessages(nextMsgs);
    setInput("");

    const data = await callAskAI(nextMsgs);

    if (data.type === "answer") {
      setMessages([...nextMsgs, {
        role: "assistant",
        content: data.content,
        sources: data.sources,
        events: data.events
      }]);
    }

    if (data.type === "pendingTool") {
      setMessages([
        ...nextMsgs,
        {
          role: "approval",
          approvalId: data.approvalId,
          toolName: data.toolName,
          input: data.input,
          postToolMessage: data.postToolMessage ?? "ช่วยสรุปผลจาก tool output ให้หน่อย",
          status: "pending",
          sources: data.sources,
        },
      ]);
    }

    setLoading(false);
  }

  async function approve(approvalId: string) {
    setLoading(true);

    setMessages((prev) =>
      prev.map((m) =>
        m.role === "approval" && m.approvalId === approvalId ? { ...m, status: "approved" } : m
      )
    );

    const approvalMsg = messages.find(
      (m) => m.role === "approval" && m.approvalId === approvalId
    ) as any;

    const res = await fetch("/api/tools/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId }),
    });

    const data = await res.json();

    if (!data.ok) {
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Tool error: ${data.error}` }]);
      setLoading(false);
      return;
    }

    const withTool = [
      ...messages.map((m) =>
        m.role === "approval" && m.approvalId === approvalId ? { ...m, status: "approved" as const } : m
      ),
      {
        role: "tool",
        toolName: data.toolName,
        content: JSON.stringify(data.result, null, 2),
      } as Msg,
      {
        role: "user",
        content: approvalMsg?.postToolMessage
          ? `${approvalMsg.postToolMessage}\n\nTool Output:\n${JSON.stringify(data.result, null, 2)}`
          : `ช่วยสรุปผลจาก Tool Output:\n${JSON.stringify(data.result, null, 2)}`,
      } as Msg,
    ];

    setMessages(withTool);

    const ai = await callAskAI(withTool);

    if (ai.type === "answer") {
      setMessages([...withTool, {
        role: "assistant",
        content: ai.content,
        sources: ai.sources,
        events: ai.events
      }]);
    } else {
      setMessages([...withTool, { role: "assistant", content: "✅ ทำงานต่อไม่สำเร็จ กรุณาลองใหม่" }]);
    }

    setLoading(false);
  }

  async function reject(approvalId: string) {
    setLoading(true);

    await fetch("/api/tools/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId }),
    });

    setMessages((prev) =>
      prev.map((m) =>
        m.role === "approval" && m.approvalId === approvalId ? { ...m, status: "rejected" } : m
      )
    );

    setMessages((prev) => [...prev, { role: "assistant", content: "รับทราบครับ ✅ ยกเลิกการเรียก Tool แล้ว" }]);
    setLoading(false);
  }

  function clearChat() {
    setMessages([]);
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

              {messages.map((m, idx) => {
                if (m.role === "user") {
                  return (
                    <div key={idx} className="group flex w-full items-end justify-end gap-4 py-4">
                      <div className="relative flex flex-col gap-2 rounded-xl px-4 py-2 text-sm min-h-[40px] bg-gray-900 text-white max-w-[80%]">
                        <div className="whitespace-pre-wrap leading-6">{m.content}</div>
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
                  return (
                    <div key={idx} className="max-w-[95%] text-sm leading-relaxed py-4">
                      <Steps events={m.events} />
                      <div className="whitespace-pre-wrap leading-6 text-gray-800">{m.content}</div>

                      {m.sources && (m.sources.docs.length > 0 || m.sources.dictionary.length > 0) && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ที่มาของข้อมูล
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {m.sources.docs.map((doc, dIdx) => (
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
                            {m.sources.dictionary.map((dict, dIdx) => (
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

                      {/* Feedback buttons */}
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
                    </div>
                  );
                }

                if (m.role === "tool") {
                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 my-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor" className="text-gray-900">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11 1.5H5C4.44772 1.5 4 1.94772 4 2.5V13.4732L7.16201 11.7485C7.68434 11.4635 8.31566 11.4635 8.83799 11.7485L12 13.4732V2.5C12 1.94772 11.5523 1.5 11 1.5ZM13.5 14.2914V2.5C13.5 1.11929 12.3807 0 11 0H5C3.61929 0 2.5 1.11929 2.5 2.5V14.2914V16L4 15.1818L7.88029 13.0653C7.95491 13.0246 8.04509 13.0246 8.11971 13.0653L12 15.1818L13.5 16V14.2914Z" />
                        </svg>
                        Source: {m.toolName}
                      </div>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
                        {m.content}
                      </pre>
                    </div>
                  );
                }

                if (m.role === "approval") {
                  return (
                    <div key={idx} className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-3 shadow-sm my-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Action Required: {m.toolName}
                      </div>
                      <pre className="text-[11px] bg-white border border-amber-100 p-2 rounded max-h-32 overflow-auto font-mono whitespace-pre-wrap">
                        {JSON.stringify(m.input, null, 2)}
                      </pre>
                      {m.sources && (m.sources.docs.length > 0 || m.sources.dictionary.length > 0) && (
                        <div className="pt-2 border-t border-amber-100">
                          <div className="flex flex-wrap gap-1.5">
                            {m.sources.docs.map((doc, dIdx) => (
                              <a
                                key={dIdx}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-white text-blue-700 text-[10px] font-medium border border-blue-100"
                              >
                                {doc.title}
                              </a>
                            ))}
                            {m.sources.dictionary.map((dict, dIdx) => (
                              <span
                                key={dIdx}
                                title={dict.title}
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-white text-purple-700 text-[10px] font-medium border border-purple-100"
                              >
                                DB: {dict.table}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(m.approvalId)}
                            disabled={loading}
                            className="flex-1 bg-white border border-gray-200 py-1.5 rounded text-xs font-medium hover:bg-gray-50 shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reject(m.approvalId)}
                            disabled={loading}
                            className="flex-1 bg-white border border-gray-200 py-1.5 rounded text-xs font-medium hover:bg-gray-50 shadow-sm text-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className={`text-[11px] font-medium ${m.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.status === "approved" ? "✓ Request Approved" : "✕ Request Rejected"}
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {loading && (
                <div className="py-4">
                  <Thinking />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4">
            <div className="pb-2 pt-2 cursor-text border border-gray-300 rounded-xl shadow-sm focus-within:border-gray-500 transition-colors duration-250">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex flex-col items-center gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask a question..."
                  className="flex bg-transparent py-2 text-sm w-full resize-none rounded-none shadow-none outline-none ring-0 min-h-0 placeholder:text-gray-500 focus-visible:ring-0 px-4"
                  style={{ height: '56px' }}
                  disabled={loading}
                />
                <div className="items-center w-full px-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
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
