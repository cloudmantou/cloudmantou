import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title = "暂无数据",
  description = "当前没有可显示的内容。",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="icon" aria-hidden="true">
        {icon ?? <Inbox size={20} />}
      </div>
      <div className="title">{title}</div>
      <div className="desc">{description}</div>
      {action}
    </div>
  );
}
