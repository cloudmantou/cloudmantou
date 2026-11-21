import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const readerSpeechEditor = readFileSync(
  join(process.cwd(), "src/components/admin/ReaderSpeechSettingsEditor.tsx"),
  "utf8",
);
const aiSettingsEditor = readFileSync(
  join(process.cwd(), "src/components/admin/AiSettingsEditor.tsx"),
  "utf8",
);
const settingsPage = readFileSync(
  join(process.cwd(), "src/app/admin/settings/page.tsx"),
  "utf8",
);

describe("admin settings save/test feedback UI", () => {
  it("overrides public hidden toast opacity inside .admin-root", () => {
    expect(globalsCss).toMatch(/\.admin-root\s+\.toast\s*\{[^}]*opacity:\s*1;/);
  });

  it("keeps reader speech save/test buttons interactive and renders inline feedback", () => {
    expect(readerSpeechEditor).toContain("disabled={operation !== null}");
    expect(readerSpeechEditor).not.toContain("disabled={invalid");
    expect(readerSpeechEditor).toContain('role="status"');
    expect(readerSpeechEditor).toContain('onNotify(issue, "err")');
    expect(readerSpeechEditor).toContain('onNotify(message, "err")');
  });

  it("keeps AI test button interactive when disabled toggle is off and shows inline success", () => {
    expect(aiSettingsEditor).not.toContain("disabled={saving || testing || !settings.enabled}");
    expect(aiSettingsEditor).toContain("请先开启「启用 AI 编辑助手」后再测试连接。");
    expect(aiSettingsEditor).toContain('role="status"');
  });

  it("scrolls to hash target after settings load and clears previous toast timer", () => {
    expect(settingsPage).toContain("window.location.hash");
    expect(settingsPage).toContain("toastTimerRef");
  });
});
