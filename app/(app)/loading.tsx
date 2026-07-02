export default function Loading() {
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
      <div className="skeleton h-36 rounded-xl" />
      <div className="skeleton h-5 w-32 rounded-lg" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-32 rounded-xl" />
      ))}
    </div>
  );
}
