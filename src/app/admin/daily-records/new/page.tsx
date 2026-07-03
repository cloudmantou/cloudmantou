"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DailyRecordComposer } from "@/components/admin/DailyRecordComposer";

export default function AdminNewDailyRecordPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/daily-records"
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
        >
          <ArrowLeft size={14} />
          返回列表
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>发布日常记录</h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
          发布后将在前台「日常记录」时间线展示
        </p>
      </div>
      <DailyRecordComposer />
    </div>
  );
}