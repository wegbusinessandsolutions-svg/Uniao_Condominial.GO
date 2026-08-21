import React from "react";

interface BaseSkeletonProps {
  className?: string;
  key?: React.Key;
}

export function SkeletonBase({ className = "" }: BaseSkeletonProps) {
  return (
    <div
      className={`bg-slate-200/80 animate-pulse rounded-md ${className}`}
    />
  );
}

export function SkeletonText({ className = "", width = "w-full", height = "h-4" }: BaseSkeletonProps & { width?: string; height?: string }) {
  return <SkeletonBase className={`${height} ${width} ${className}`} />;
}

export function SkeletonCircle({ size = "h-12 w-12", className = "" }: BaseSkeletonProps & { size?: string }) {
  return <SkeletonBase className={`rounded-full ${size} ${className}`} />;
}

export function SkeletonCard({ className = "" }: BaseSkeletonProps) {
  return (
    <div className={`bg-white rounded-2xl p-6 border border-slate-150/85 shadow-xs space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <div className="space-y-2 flex-1">
          <SkeletonText width="w-24" height="h-3" />
          <SkeletonText width="w-32" height="h-6" />
        </div>
        <SkeletonCircle size="h-10 w-10" />
      </div>
      <div className="pt-2">
        <SkeletonText width="w-2/3" height="h-3" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5, className = "" }: BaseSkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
        <SkeletonText width="w-1/4" height="h-5" />
        <div className="flex gap-2">
          <SkeletonBase className="h-8 w-24 rounded-lg" />
          <SkeletonBase className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/30">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="p-4">
                  <SkeletonText width={i % 2 === 0 ? "w-16" : "w-24"} height="h-3" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="hover:bg-slate-50/30">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="p-4">
                    <SkeletonText width={c === 0 ? "w-32" : c === cols - 1 ? "w-12 ml-auto" : "w-20"} height="h-4" />
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

export function SkeletonForm({ fields = 4, className = "" }: BaseSkeletonProps & { fields?: number }) {
  return (
    <div className={`bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6 ${className}`}>
      <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
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
      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
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
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
