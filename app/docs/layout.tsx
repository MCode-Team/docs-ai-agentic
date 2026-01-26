"use client";

import { useState } from "react";
import { DocsSidebar } from "@/components/docs-sidebar";
import { AskAIChat } from "@/components/ask-ai-chat";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const [isAskAIOpen, setIsAskAIOpen] = useState(false);

    return (
        <div className="flex h-screen bg-white">
            {/* Main Area - shrinks when Ask AI is open */}
            <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isAskAIOpen ? 'mr-[380px]' : ''}`}>
                {/* Header */}
                <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-white z-20">
                    <div className="flex items-center gap-1">
                        {/* Logo */}
                        <div className="flex items-center gap-2 pr-4">
                            <svg className="w-5 h-5" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="black" />
                            </svg>
                            <span className="font-bold text-lg tracking-tight">Vercel</span>
                        </div>

                        {/* Navigation */}
                        <nav className="hidden lg:flex items-center text-[13px] font-medium">
                            <button className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-black transition-colors">
                                Products
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1.5 text-black border-b-2 border-black -mb-px">
                                Resources
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-black transition-colors">
                                Solutions
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className="px-3 py-1.5 text-gray-600 hover:text-black transition-colors">
                                Enterprise
                            </button>
                            <button className="px-3 py-1.5 text-gray-600 hover:text-black transition-colors">
                                Pricing
                            </button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative hidden md:block">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                placeholder="Search Documentation..."
                                className="bg-gray-50 border border-border rounded-md pl-9 pr-10 py-1.5 text-[13px] w-52 focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
                            />
                            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                <span className="text-[10px] text-gray-400 font-medium">⌘ K</span>
                            </div>
                        </div>

                        {/* Ask AI Button */}
                        <button
                            onClick={() => setIsAskAIOpen(!isAskAIOpen)}
                            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${isAskAIOpen
                                ? "bg-black text-white"
                                : "bg-black text-white hover:bg-gray-800"
                                }`}
                        >
                            Ask AI
                        </button>

                        {/* User Avatar */}
                        <div className="w-7 h-7 rounded-full bg-linear-to-tr from-teal-400 to-cyan-500 cursor-pointer" />
                    </div>
                </header>


                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Navigation */}
                    <aside className="w-56 border-r border-border overflow-auto py-6 px-4 shrink-0 hidden lg:block">
                        <div className="flex items-center gap-2 mb-6 px-2 text-sm text-gray-500">
                            <span className="text-gray-900 font-medium">Docs</span>
                            <span className="text-gray-400">API Reference ▼</span>
                        </div>
                        <DocsSidebar />
                    </aside>

                    {/* Center Content */}
                    <main className="flex-1 overflow-auto min-w-0">
                        <div className="py-8 px-8 max-w-3xl">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Vercel Agent
                            </div>
                            {children}
                        </div>
                    </main>

                    {/* Right Sidebar - "On this page" - Always visible, pushed when Ask AI opens */}
                    <aside className="w-56 overflow-auto py-8 px-4 shrink-0 hidden xl:block">
                        <div className="text-[13px] font-semibold mb-4">On this page</div>
                        <ul className="text-[13px] text-gray-500 space-y-2">
                            <li className="text-gray-900 border-l-2 border-black pl-3 py-0.5">Features</li>
                            <li className="pl-3 hover:text-gray-900 cursor-pointer py-0.5">Code Review</li>
                            <li className="pl-3 hover:text-gray-900 cursor-pointer py-0.5">Investigation</li>
                            <li className="pl-3 hover:text-gray-900 cursor-pointer py-0.5">Getting started</li>
                            <li className="pl-3 hover:text-gray-900 cursor-pointer py-0.5">Pricing</li>
                            <li className="pl-3 hover:text-gray-900 cursor-pointer py-0.5">Privacy</li>
                        </ul>

                        <div className="mt-8 space-y-3 pt-6 border-t border-border">
                            <div className="flex items-center gap-2 text-xs text-gray-500 hover:text-black cursor-pointer">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Copy as Markdown
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 hover:text-black cursor-pointer">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                Give feedback
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 hover:text-black cursor-pointer" onClick={() => setIsAskAIOpen(true)}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                Ask AI about this page
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Ask AI Sidebar - Fixed, Full Height from Top */}
            <aside
                className={`fixed top-0 right-0 bottom-0 w-[380px] bg-white border-l border-border z-30 transform transition-transform duration-300 ease-in-out ${isAskAIOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <AskAIChat onClose={() => setIsAskAIOpen(false)} />
            </aside>
        </div>
    );
}

