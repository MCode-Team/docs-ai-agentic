interface DocPageProps {
    params: Promise<{ slug: string }>;
}

export default async function DocPage({ params }: DocPageProps) {
    const { slug } = await params;

    return (
        <article className="prose prose-sm max-w-none">
            <h1 className="text-4xl font-bold tracking-tight mb-4 capitalize">{slug.replace(/-/g, ' ')}</h1>

            <div className="flex items-center gap-6 text-[13px] text-gray-500 mb-8 border-b border-border pb-4">
                <div className="flex items-center gap-1.5 hover:text-gray-900 cursor-pointer transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Copy as Markdown
                </div>
                <div className="flex items-center gap-1.5 hover:text-gray-900 cursor-pointer transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Ask AI about this page
                </div>
                <div className="ml-auto">
                    Last updated October 28, 2025
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-8 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-gray-800">
                    <span className="font-semibold">{slug.replace(/-/g, ' ')}</span> is available in <span className="text-blue-600 font-medium">Beta</span> on <span className="font-medium">Enterprise</span> and <span className="font-medium">Pro</span> plans.
                </div>
            </div>

            <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Vercel Agent is a suite of AI-powered development tools built to speed up your workflow.
                Instead of spending hours debugging production issues or waiting for code reviews,
                Agent helps you catch problems faster and resolve incidents quickly.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12 mb-4">Features</h2>

            <h3 className="text-xl font-semibold mt-8 mb-2">Code Review</h3>
            <p>Get automatic code reviews on every pull request. Code Review analyzes your changes, identifies potential issues, and suggests fixes you can apply directly.</p>
        </article>
    );
}
