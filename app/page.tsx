import Link from "next/link";

export default function Home() {
    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold">Docs + Ask AI</h1>
            <p className="mt-2 text-gray-600">
                ไปที่หน้าเอกสาร:{" "}
                <Link href="/docs/getting-started" className="underline hover:text-blue-600">
                    /docs/getting-started
                </Link>
            </p>
        </div>
    );
}
