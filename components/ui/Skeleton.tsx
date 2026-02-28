'use client';

export function SkeletonText({ lines = 2, width }: { lines?: number; width?: string }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={i === lines - 1 ? { width: width || '55%' } : undefined}
        />
      ))}
    </div>
  );
}

export function SkeletonKPI() {
  return <div className="skeleton skeleton-kpi" />;
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return <div className="skeleton skeleton-card" style={{ height }} />;
}
