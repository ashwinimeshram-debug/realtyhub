export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: "var(--primary)" }} />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
