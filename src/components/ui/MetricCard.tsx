import clsx from "clsx";
import type { DashboardMetric } from "@/types";

type MetricCardProps = {
  metric: DashboardMetric;
  index?: number;
};

export function MetricCard({ metric, index = 0 }: MetricCardProps) {
  return (
    <article className="metric-card fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <div className={clsx("metric-value", `text-${metric.accent}`)}>{metric.value}</div>
      <div className="metric-label">{metric.label}</div>
      <div className="metric-delta">{metric.delta}</div>
    </article>
  );
}
