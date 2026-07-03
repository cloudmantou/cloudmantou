"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Image as ImageIcon, Loader2, MapPin } from "lucide-react";
import clsx from "clsx";
import { compressImage } from "@/lib/image-compress";

const MOOD_OPTIONS = ["😊", "😌", "🤔", "😴", "🔥", "🎉", "😤", "☕"];
const WEATHER_OPTIONS = ["☀️", "⛅", "🌧️", "❄️", "🌙"];
const VISIBILITY_OPTIONS = [
  { id: "public" as const, label: "🌐 所有人可见" },
  { id: "friends" as const, label: "👥 仅好友" },
  { id: "link" as const, label: "🔗 链接可见" },
  { id: "private" as const, label: "🔒 仅自己" },
];

type Props = {
  onSuccess?: () => void;
  redirectToList?: boolean;
};

export function DailyRecordComposer({ onSuccess, redirectToList = true }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [weather, setWeather] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(["日常"]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]["id"]>("public");
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const displayName = session?.user?.nickname || session?.user?.username || "管理员";

  const cycleVisibility = () => {
    const idx = VISIBILITY_OPTIONS.findIndex((v) => v.id === visibility);
    setVisibility(VISIBILITY_OPTIONS[(idx + 1) % VISIBILITY_OPTIONS.length].id);
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, "");
    if (!tag || tags.includes(tag) || tags.length >= 10) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  };

  const uploadPhoto = async (file: File) => {
    const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });
    const formData = new FormData();
    formData.append("file", compressed);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "图片上传失败");
    }
    const data = await res.json();
    return data.data.url as string;
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 9 - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;

    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of selected) {
        urls.push(await uploadPhoto(file));
      }
      setPhotos((prev) => [...prev, ...urls].slice(0, 9));
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片上传失败");
    }
    setUploading(false);
  };

  const handlePublish = async () => {
    if (!content.trim()) return;
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/daily-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          photos: photos.length > 0 ? photos : undefined,
          mood: mood || undefined,
          weather: weather || undefined,
          location: location.trim() || undefined,
          visibility,
          tagNames: tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "发布失败");
      }
      onSuccess?.();
      if (redirectToList) {
        router.push("/admin/daily-records");
      } else {
        setContent("");
        setMood("");
        setWeather("");
        setLocation("");
        setPhotos([]);
        setTags(["日常"]);
        setVisibility("public");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
    setPublishing(false);
  };

  return (
    <div className="admin-panel" style={{ padding: 24 }}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff" }}
        >
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{displayName}</div>
          <button
            type="button"
            onClick={cycleVisibility}
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace', background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.label}
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 2000))}
        placeholder="这一刻的想法..."
        rows={5}
        className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none resize-none"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", lineHeight: 1.8 }}
      />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          <span className="text-[10px] mr-1" style={{ color: "var(--text-muted)" }}>心情</span>
          {MOOD_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setMood(mood === emoji ? "" : emoji)}
              className={clsx("w-8 h-8 rounded-full text-sm")}
              style={{
                border: mood === emoji ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: mood === emoji ? "var(--accent-dim)" : "transparent",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] mr-1" style={{ color: "var(--text-muted)" }}>天气</span>
          {WEATHER_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setWeather(weather === emoji ? "" : emoji)}
              className={clsx("w-8 h-8 rounded-full text-sm")}
              style={{
                border: weather === emoji ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: weather === emoji ? "var(--accent-dim)" : "transparent",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <MapPin size={14} style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="添加位置（可选）"
          className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
      </div>

      {photos.length > 0 && (
        <div
          className="grid gap-2 mb-4"
          style={{ gridTemplateColumns: photos.length <= 2 ? "1fr 1fr" : "repeat(3, 1fr)" }}
        >
          {photos.map((photo, i) => (
            <div key={photo} className="relative aspect-[4/3] rounded-lg overflow-hidden" style={{ background: "var(--bg)" }}>
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : null}
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full text-xs"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer" }}
                aria-label="移除图片"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            #{tag}
            <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="添加标签..."
          className="w-24 px-2 py-1 text-[10px] outline-none bg-transparent"
          style={{ color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
        />
      </div>

      {error ? (
        <p className="text-xs mb-3" style={{ color: "var(--rose)" }}>{error}</p>
      ) : null}

      <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <label
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            图片
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploading || photos.length >= 9}
              onChange={(e) => {
                handlePhotoUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span
            className="text-[10px]"
            style={{
              color: content.length >= 2000 ? "var(--rose)" : content.length > 1800 ? "var(--orange)" : "var(--text-muted)",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {content.length} / 2000
          </span>
        </div>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || uploading || !content.trim()}
          className="px-5 py-2 rounded-lg text-xs font-medium"
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            opacity: publishing || uploading || !content.trim() ? 0.5 : 1,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {publishing ? "发布中..." : "发布记录"}
        </button>
      </div>
    </div>
  );
}