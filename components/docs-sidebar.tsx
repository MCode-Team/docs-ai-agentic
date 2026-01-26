export function DocsSidebar() {
    return (
        <div className="flex flex-col gap-6 text-[13px]">
            <div>
                <div className="font-semibold text-gray-900 mb-3 px-2">Getting Started</div>
                <nav className="flex flex-col space-y-0.5">
                    <a className="px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors" href="/docs/getting-started">
                        Projects and Deployments
                    </a>
                    <a className="px-2 py-1.5 rounded-md bg-gray-100 text-blue-600 font-medium" href="/docs/use-a-template">
                        Use a Template
                    </a>
                    <a className="px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors" href="/docs/import-existing">
                        Import Existing Project
                    </a>
                    <a className="px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors" href="/docs/add-domain">
                        Add a Domain
                    </a>
                    <a className="px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors" href="/docs/mcp">
                        MCP
                    </a>
                </nav>
            </div>

            <div>
                <div className="font-semibold text-gray-900 mb-3 px-2 flex items-center justify-between">
                    Supported Frameworks
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <div>
                <div className="font-semibold text-gray-900 mb-3 px-2 flex items-center justify-between">
                    Incremental Migration
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>

            <div>
                <div className="font-semibold text-gray-900 mb-3 px-2 flex items-center justify-between">
                    Production Checklist
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
