export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: "var(--primary)" }} />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
