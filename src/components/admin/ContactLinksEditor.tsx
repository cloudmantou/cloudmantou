"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  CONTACT_LINK_PRESETS,
  type ContactLink,
  type ContactLinkKind,
} from "@/lib/contact-links";
import { uploadImageFile } from "@/lib/upload-image-client";

type Props = {
  links: ContactLink[];
  onChange: (links: ContactLink[]) => void;
};

function newLink(kind: ContactLinkKind, sortOrder: number): ContactLink {
  const preset = CONTACT_LINK_PRESETS.find((p) => p.kind === kind);
  return {
    id: crypto.randomUUID(),
    kind,
    label: preset?.label || "联系方式",
    enabled: true,
    sortOrder,
    href: "",
    iconUrl: "",
    qrImageUrl: "",
  };
}

export function ContactLinksEditor({ links, onChange }: Props) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const updateLink = (id: string, patch: Partial<ContactLink>) => {
    onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  };

  const removeLink = (id: string) => {
    onChange(links.filter((link) => link.id !== id));
  };

  const addPreset = (kind: ContactLinkKind) => {
    if (links.length >= 12) return;
    onChange([...links, newLink(kind, links.length)]);
  };

  const uploadFor = async (id: string, field: "iconUrl" | "qrImageUrl", file: File) => {
    const key = `${id}:${field}`;
    setUploadingKey(key);
    try {
      const url = await uploadImageFile(file, { purpose: "general" });
      updateLink(id, { [field]: url });
    } catch (error) {
      alert(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="contact-links-editor">
      <div className="contact-links-presets">
        {CONTACT_LINK_PRESETS.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            className="contact-links-preset-btn"
            onClick={() => addPreset(preset.kind)}
            disabled={links.length >= 12}
          >
            <Plus size={12} />
            {preset.label}
          </button>
        ))}
      </div>

      {links.length === 0 ? (
        <p className="contact-links-empty">尚未配置联系方式，点击上方按钮添加。</p>
      ) : (
        <div className="contact-links-list">
          {links.map((link, index) => (
            <ContactLinkCard
              key={link.id}
              link={link}
              index={index}
              uploadingKey={uploadingKey}
              onUpdate={(patch) => updateLink(link.id, patch)}
              onRemove={() => removeLink(link.id)}
              onUpload={(field, file) => uploadFor(link.id, field, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactLinkCard({
  link,
  index,
  uploadingKey,
  onUpdate,
  onRemove,
  onUpload,
}: {
  link: ContactLink;
  index: number;
  uploadingKey: string | null;
  onUpdate: (patch: Partial<ContactLink>) => void;
  onRemove: () => void;
  onUpload: (field: "iconUrl" | "qrImageUrl", file: File) => void;
}) {
  const iconInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const preset = CONTACT_LINK_PRESETS.find((p) => p.kind === link.kind);

  return (
    <div className={`contact-link-card${link.enabled ? "" : " is-disabled"}`}>
      <div className="contact-link-card-head">
        <span className="contact-link-drag" aria-hidden="true">
          <GripVertical size={14} />
          {index + 1}
        </span>
        <input
          type="text"
          className="form-input"
          value={link.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          maxLength={40}
          placeholder="显示名称"
        />
        <select
          className="form-input contact-link-kind"
          value={link.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as ContactLinkKind })}
        >
          {CONTACT_LINK_PRESETS.map((p) => (
            <option key={p.kind} value={p.kind}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`switch${link.enabled ? " on" : ""}`}
          aria-pressed={link.enabled}
          aria-label="启用"
          onClick={() => onUpdate({ enabled: !link.enabled })}
        >
          <span className="switch-knob" />
        </button>
        <button type="button" className="contact-link-remove" aria-label="删除" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>

      {preset ? <p className="contact-link-hint">{preset.hint}</p> : null}

      <div className="contact-link-fields">
        <label className="contact-link-field">
          <span>跳转链接</span>
          <input
            type="text"
            className="form-input mono"
            value={link.href || ""}
            onChange={(e) => onUpdate({ href: e.target.value })}
            placeholder={
              link.kind === "email"
                ? "hello@example.com 或 mailto:..."
                : link.kind === "telegram"
                  ? "https://t.me/username"
                  : "https://..."
            }
          />
        </label>

        <div className="contact-link-uploads">
          <UploadSlot
            label="自定义图标"
            imageUrl={link.iconUrl}
            uploading={uploadingKey === `${link.id}:iconUrl`}
            inputRef={iconInputRef}
            onPick={() => iconInputRef.current?.click()}
            onClear={() => onUpdate({ iconUrl: "" })}
            onFile={(file) => onUpload("iconUrl", file)}
          />
          <UploadSlot
            label="二维码图片"
            imageUrl={link.qrImageUrl}
            uploading={uploadingKey === `${link.id}:qrImageUrl`}
            inputRef={qrInputRef}
            onPick={() => qrInputRef.current?.click()}
            onClear={() => onUpdate({ qrImageUrl: "" })}
            onFile={(file) => onUpload("qrImageUrl", file)}
          />
        </div>
      </div>
    </div>
  );
}

function UploadSlot({
  label,
  imageUrl,
  uploading,
  inputRef,
  onPick,
  onClear,
  onFile,
}: {
  label: string;
  imageUrl?: string;
  uploading: boolean;
  inputRef: React.Ref<HTMLInputElement>;
  onPick: () => void;
  onClear: () => void;
  onFile: (file: File) => void;
}) {
  return (
    <div className="contact-upload-slot">
      <span className="contact-upload-label">{label}</span>
      <div className="contact-upload-box">
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={56} height={56} className="contact-upload-preview" unoptimized />
        ) : (
          <div className="contact-upload-placeholder">未上传</div>
        )}
        <div className="contact-upload-actions">
          <button type="button" className="secondary-button" onClick={onPick} disabled={uploading}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            上传
          </button>
          {imageUrl ? (
            <button type="button" className="secondary-button" onClick={onClear} disabled={uploading}>
              清除
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}