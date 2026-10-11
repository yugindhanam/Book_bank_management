export default function Loading() {
  return (
    <div aria-label="Loading page" className="skeleton-page">
      <div className="skeleton h-20" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-36" />
        ))}
      </div>
      <div className="skeleton h-96" />
    </div>
  );
}
