import type { CSSProperties } from 'react';

/**
 * Loading placeholders shaped like the content they stand in for. Each group is one
 * "Loading …" status for assistive technology; the shapes themselves are hidden from it.
 */
const size = (width?: string | number, height?: number): CSSProperties => ({ width, height });

export function Bone({
  width,
  height,
  className = 'line',
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return <span className={`skeleton ${className}`} style={size(width, height)} />;
}

function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="skeletons stack" role="status" aria-label={label} aria-busy="true">
      <div aria-hidden className="stack">
        {children}
      </div>
    </div>
  );
}

function CardBones({ lines = 3, chart }: { lines?: number; chart?: number }) {
  return (
    <div className="card skeleton-card">
      <Bone className="title" />
      {chart ? <Bone className="" height={chart} width="100%" /> : null}
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} width={`${90 - i * 15}%`} />
      ))}
    </div>
  );
}

function KpiBones({ count = 6 }: { count?: number }) {
  return (
    <div className="kpis">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi skeleton-card">
          <Bone width="50%" />
          <Bone height={26} width="70%" />
          <Bone width="60%" />
        </div>
      ))}
    </div>
  );
}

/** Product, startup name and badges, then the view tabs. */
function SimulationHeaderBones() {
  return (
    <>
      <div className="sim-header">
        <div>
          <Bone width={120} />
          <Bone className="title" width={220} />
        </div>
        <Bone width={280} height={20} />
      </div>
      <Bone width="100%" height={34} />
    </>
  );
}

export function DashboardSkeleton({ header = true }: { header?: boolean }) {
  return (
    <Loading label="Loading the dashboard">
      {header && <SimulationHeaderBones />}
      <div className="dash">
        <div className="stack">
          <KpiBones />
          <CardBones lines={0} chart={260} />
          <div className="two-col">
            <CardBones lines={6} />
            <CardBones lines={6} />
          </div>
        </div>
        <div className="stack">
          <CardBones lines={8} />
        </div>
      </div>
    </Loading>
  );
}

export function AnalyticsSkeleton({ header = true }: { header?: boolean }) {
  return (
    <Loading label="Loading analytics">
      {header && <SimulationHeaderBones />}
      <Bone width={360} height={30} />
      <KpiBones />
      <div className="two-col">
        <CardBones lines={0} chart={240} />
        <CardBones lines={0} chart={240} />
      </div>
      <CardBones lines={0} chart={240} />
    </Loading>
  );
}

export function TimelineSkeleton({ header = true }: { header?: boolean }) {
  return (
    <Loading label="Loading the turn history">
      {header && <SimulationHeaderBones />}
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skeleton-card">
          <div className="card-head">
            <Bone width={90} height={20} />
            <Bone width="55%" />
          </div>
          <div className="grid-3">
            {[0, 1, 2].map((j) => (
              <div key={j}>
                <Bone width="40%" />
                <Bone width="90%" />
                <Bone width="70%" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** Cards in a grid: the startup list, admin tiles and similar pages. */
export function CardGridSkeleton({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <Loading label={label}>
      <div className="startup-grid">
        {Array.from({ length: cards }, (_, i) => (
          <CardBones key={i} lines={5} />
        ))}
      </div>
    </Loading>
  );
}

/** A generic page: heading and a couple of cards (lazy routes, account pages). */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <Loading label={label}>
      <Bone className="title" />
      <CardBones lines={4} />
      <CardBones lines={3} />
    </Loading>
  );
}

export function TableSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <Loading label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Bone key={i} width="100%" height={18} />
      ))}
    </Loading>
  );
}
