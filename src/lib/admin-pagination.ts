export type PageWindowItem = number | "gap";

/**
 * 后台分页窗口：始终包含首页、末页和当前页附近的页码，中间用省略号代替，
 * 避免页数很多时一次渲染全部按钮，或把超过前 10 页的数据藏起来。
 */
export function buildPageWindow(page: number, totalPages: number, radius = 2): PageWindowItem[] {
  const last = Math.max(1, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), last);
  const pages = new Set<number>([1, last]);
  for (let p = current - radius; p <= current + radius; p += 1) {
    if (p >= 1 && p <= last) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageWindowItem[] = [];
  sorted.forEach((p, index) => {
    const prev = sorted[index - 1];
    if (prev !== undefined && p - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) items.push("gap");
    items.push(p);
  });
  return items;
}

/** 删除当前页最后一条后，回退到仍有数据的页码。 */
export function clampPageAfterRemoval(page: number, remainingOnPage: number): number {
  return remainingOnPage <= 0 && page > 1 ? page - 1 : page;
}
