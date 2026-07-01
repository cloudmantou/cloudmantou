import clsx from "clsx";
import type { Accent } from "@/types";

type AccentTagProps = {
  children: string;
  accent?: Accent;
};

export function AccentTag({ children, accent = "gold" }: AccentTagProps) {
  return <span className={clsx("accent-tag", `accent-${accent}`)}>{children}</span>;
}
