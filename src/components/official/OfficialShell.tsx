import type { ReactNode } from "react";
import { OfficialNavbar } from "@/components/official/OfficialNavbar";
import { OfficialFooter } from "@/components/official/OfficialFooter";
import { OfficialPageTransition } from "@/components/official/OfficialPageTransition";

type Props = {
  children: ReactNode;
};

export function OfficialShell({ children }: Props) {
  return (
    <div className="official-page">
      <OfficialNavbar />
      <main className="official-main">
        <OfficialPageTransition>{children}</OfficialPageTransition>
      </main>
      <OfficialFooter />
    </div>
  );
}
