import { describe, it, expect } from "vitest";

// Test the order number generation logic
function generateOrderNo(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `ORD${datePart}${rand}`;
}

// Test the card number generation logic
function generateCardNo(): string {
  const prefix = "CM";
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${rand}`;
}

// Test the CSV export generation
function generateCSV(cards: Array<{ cardNo: string; cardSecret: string; type: string; value: number; status: string }>): string {
  const header = "卡号,卡密,类型,数值,状态";
  const rows = cards.map((c) => [c.cardNo, c.cardSecret, c.type, c.value, c.status].join(","));
  return [header, ...rows].join("\n");
}

// Test content snippet extraction
function extractSnippet(text: string, q: string, radius = 80): string | null {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  const snippet = text.slice(start, end).replace(/\n/g, " ");
  return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
}

// Test reading time estimation
function estimateReadTime(content: string | null): string {
  if (!content) return "付费内容";
  const chars = content.length;
  const minutes = Math.max(1, Math.ceil(chars / 500));
  return `${minutes} 分钟`;
}

describe("Order number generation", () => {
  it("should start with ORD prefix", () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^ORD\d{8}/);
  });

  it("should generate unique numbers", () => {
    const nos = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    expect(nos.size).toBe(100);
  });
});

describe("Card number generation", () => {
  it("should start with CM prefix", () => {
    const cardNo = generateCardNo();
    expect(cardNo).toMatch(/^CM-/);
  });

  it("should generate unique numbers", () => {
    const nos = new Set(Array.from({ length: 100 }, () => generateCardNo()));
    expect(nos.size).toBe(100);
  });
});

describe("CSV export", () => {
  it("should generate valid CSV with header", () => {
    const csv = generateCSV([
      { cardNo: "CM-ABC12", cardSecret: "DEF345", type: "VIP_DAYS", value: 30, status: "ACTIVE" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("卡号,卡密,类型,数值,状态");
    expect(lines[1]).toBe("CM-ABC12,DEF345,VIP_DAYS,30,ACTIVE");
  });

  it("should handle empty array", () => {
    const csv = generateCSV([]);
    expect(csv).toBe("卡号,卡密,类型,数值,状态");
  });
});

describe("Content snippet extraction", () => {
  it("should find and extract snippet around match", () => {
    const text = "A".repeat(200) + "hello world" + "B".repeat(200);
    const snippet = extractSnippet(text, "hello");
    expect(snippet).toContain("hello");
    expect(snippet).toContain("...");
  });

  it("should return null if no match", () => {
    expect(extractSnippet("nothing here", "xyz")).toBeNull();
  });

  it("should be case insensitive", () => {
    const snippet = extractSnippet("Hello World", "hello");
    expect(snippet).toBeTruthy();
  });

  it("should not add leading ... if match is at start", () => {
    const snippet = extractSnippet("hello world test", "hello");
    expect(snippet).not.toMatch(/^\.\.\./);
  });
});

describe("Reading time estimation", () => {
  it("should return 1 min for short content", () => {
    expect(estimateReadTime("short")).toBe("1 分钟");
  });

  it("should calculate based on 500 chars/min", () => {
    const content = "A".repeat(1500);
    expect(estimateReadTime(content)).toBe("3 分钟");
  });

  it("should handle null content", () => {
    expect(estimateReadTime(null)).toBe("付费内容");
  });

  it("should return at least 1 minute", () => {
    expect(estimateReadTime("a")).toBe("1 分钟");
  });
});
