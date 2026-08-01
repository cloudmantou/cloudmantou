"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** 路由切换时复用博客版 page-in 过渡 */
export function OfficialPageTransition({ children }: Props) {
  const pathname = usePathname() || "/";

  return (
    <div key={pathname} className="official-page-enter">
      {children}
    </div>
  );
}