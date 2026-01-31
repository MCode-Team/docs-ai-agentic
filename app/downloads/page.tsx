import Link from "next/link";

async function fetchArtifacts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/artifacts`, {
    // Ensure this is always dynamic
    cache: "no-store",
  });
  return res.json();
}

export default async function DownloadsPage() {
  const data = await fetchArtifacts();
  const artifacts = (data?.artifacts || []) as Array<{
    id: string;
    filename: string;
    created_at: string;
    expires_at: string;
  }>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Downloads</h1>
        <Link className="text-sm text-blue-600 hover:underline" href="/">
          Back
        </Link>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        ไฟล์จะหมดอายุภายใน 24 ชั่วโมงหลังสร้าง (ตามค่า expires_at)
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Filename</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={4}>
                  No files yet.
                </td>
              </tr>
            ) : (
              artifacts.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="p-3 font-mono break-all">{a.filename}</td>
                  <td className="p-3">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="p-3">{new Date(a.expires_at).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <a
                      className="text-blue-600 hover:underline"
                      href={`/api/artifacts/${a.id}`}
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
