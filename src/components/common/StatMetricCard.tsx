import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatMetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string; // e.g. "vs mês anterior"
  };
  subtitle?: string;
  footer?: React.ReactNode;
  badge?: string;
  onClick?: () => void;
}

export function StatMetricCard({
  title,
  value,
  icon: Icon,
  iconBgColor = "bg-blue-50 dark:bg-blue-950/50",
  iconColor = "text-blue-600 dark:text-blue-400",
  trend,
  subtitle,
  footer,
  badge,
  onClick,
}: StatMetricCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs transition-all relative overflow-hidden flex flex-col justify-between ${
        isClickable
          ? "cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99]"
          : ""
      }`}
    >
      {/* Top row: Title and Icon */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider line-clamp-1">
            {title}
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor}`}>
            <Icon size={18} />
          </div>
        </div>

        {/* Value */}
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {value}
          </h3>
          {badge && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Trend or Subtitle */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        {trend ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                trend.direction === "up"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                  : trend.direction === "down"
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {trend.direction === "up" && <TrendingUp size={12} />}
              {trend.direction === "down" && <TrendingDown size={12} />}
              {trend.direction === "neutral" && <Minus size={12} />}
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {trend.label}
              </span>
            )}
          </div>
        ) : subtitle ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {subtitle}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Atualizado em tempo real</span>
        )}

        {footer}
      </div>
    </div>
  );
}
export default StatMetricCard;
