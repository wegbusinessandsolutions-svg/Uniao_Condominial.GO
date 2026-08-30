import React from "react";

interface BaseSkeletonProps {
  className?: string;
  key?: React.Key;
  style?: React.CSSProperties;
}

export function SkeletonBase({ className = "", style }: BaseSkeletonProps) {
  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-slate-200/70 dark:bg-slate-800/80 rounded-md before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent ${className}`}
    />
  );
}

export function SkeletonText({
  className = "",
  width = "w-full",
  height = "h-4",
}: BaseSkeletonProps & { width?: string; height?: string }) {
  return <SkeletonBase className={`${height} ${width} rounded-md ${className}`} />;
}

export function SkeletonCircle({
  size = "h-12 w-12",
  className = "",
}: BaseSkeletonProps & { size?: string }) {
  return <SkeletonBase className={`rounded-full ${size} shrink-0 ${className}`} />;
}

export function SkeletonCard({ className = "" }: BaseSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 ${className}`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1 pr-4">
          <SkeletonText width="w-24" height="h-3" />
          <SkeletonText width="w-36" height="h-7" />
        </div>
        <SkeletonCircle size="h-10 w-10" />
      </div>
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <SkeletonText width="w-28" height="h-3" />
        <SkeletonText width="w-16" height="h-3" />
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 5,
  className = "",
}: BaseSkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs ${className}`}
    >
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4">
        <div className="space-y-1.5 flex-1">
          <SkeletonText width="w-44" height="h-4" />
          <SkeletonText width="w-64" height="h-3" />
        </div>
        <div className="flex gap-2">
          <SkeletonBase className="h-8 w-28 rounded-lg" />
          <SkeletonBase className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3.5">
                  <SkeletonText width={i === 0 ? "w-28" : i % 2 === 0 ? "w-20" : "w-24"} height="h-3.5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="px-4 py-3.5">
                    {c === 0 ? (
                      <div className="flex items-center gap-3">
                        <SkeletonCircle size="w-8 h-8" />
                        <div className="space-y-1.5 flex-1">
                          <SkeletonText width="w-32" height="h-4" />
                          <SkeletonText width="w-20" height="h-2.5" />
                        </div>
                      </div>
                    ) : c === cols - 1 ? (
                      <div className="flex items-center justify-end gap-2">
                        <SkeletonBase className="h-7 w-7 rounded-md" />
                        <SkeletonBase className="h-7 w-7 rounded-md" />
                        <SkeletonBase className="h-7 w-7 rounded-md" />
                      </div>
                    ) : (
                      <SkeletonText
                        width={c % 2 === 0 ? "w-24" : "w-16"}
                        height="h-3.5"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonForm({
  fields = 4,
  className = "",
}: BaseSkeletonProps & { fields?: number }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 ${className}`}
    >
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex justify-between items-center">
        <div className="space-y-2">
          <SkeletonText width="w-48" height="h-6" />
          <SkeletonText width="w-72" height="h-3.5" />
        </div>
        <SkeletonBase className="h-9 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonText width="w-24" height="h-3" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
        <SkeletonBase className="h-10 w-24 rounded-xl" />
        <SkeletonBase className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonReportDashboard({ className = "" }: BaseSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top controls skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonText width="w-32" height="h-5" />
          <SkeletonText width="w-64" height="h-3.5" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SkeletonBase className="h-10 w-36 rounded-xl" />
          <SkeletonBase className="h-10 w-44 rounded-xl" />
          <SkeletonBase className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      {/* Grid of Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Table Skeleton */}
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}

export function SkeletonCharts({ className = "" }: BaseSkeletonProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
      {/* Line/Bar chart skeleton */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-10 h-10" />
              <div className="space-y-1.5">
                <SkeletonText width="w-36" height="h-4" />
                <SkeletonText width="w-56" height="h-3" />
              </div>
            </div>
            <SkeletonText width="w-28" height="h-3.5" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-8 h-8" />
              <div className="space-y-1">
                <SkeletonText width="w-20" height="h-2.5" />
                <SkeletonText width="w-24" height="h-4" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-8 h-8" />
              <div className="space-y-1">
                <SkeletonText width="w-24" height="h-2.5" />
                <SkeletonText width="w-20" height="h-4" />
              </div>
            </div>
          </div>
        </div>
        <div className="h-64 w-full flex items-end gap-3 pt-4 px-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <SkeletonBase
                className="w-full rounded-t-md"
                style={{ height: `${25 + ((i * 19) % 65)}%` }}
              />
              <SkeletonText width="w-8" height="h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Pie/Donut chart skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SkeletonCircle size="w-10 h-10" />
            <div className="space-y-1.5">
              <SkeletonText width="w-40" height="h-4" />
              <SkeletonText width="w-48" height="h-3" />
            </div>
          </div>
        </div>
        <div className="h-64 w-full flex flex-col items-center justify-center gap-4">
          <SkeletonCircle size="w-36 h-36" className="border-8 border-slate-100 dark:border-slate-800" />
          <div className="flex gap-2 justify-center w-full">
            <SkeletonBase className="h-3 w-16 rounded" />
            <SkeletonBase className="h-3 w-16 rounded" />
            <SkeletonBase className="h-3 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminContentSkeleton({ className = "" }: BaseSkeletonProps) {
  return (
    <div className={`space-y-6 animate-in fade-in duration-200 ${className}`}>
      {/* Top Banner Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonText width="w-48" height="h-7" />
          <SkeletonText width="w-80" height="h-4" />
        </div>
        <div className="flex gap-2">
          <SkeletonBase className="h-10 w-28 rounded-xl" />
          <SkeletonBase className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart Section Placeholder */}
      <SkeletonCharts />
    </div>
  );
}

