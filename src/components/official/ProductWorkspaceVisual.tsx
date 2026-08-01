"use client";

import Image from "next/image";
import {
  BookOpen,
  CheckCircle2,
  FileKey2,
  History,
  MapPin,
  RefreshCcw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";

const TOOL_ICONS = [History, MapPin, FileKey2, WifiOff, RefreshCcw, BookOpen] as const;

export function ProductWorkspaceVisual() {
  const { messages } = useOfficialI18n();
  const copy = messages.home.workspace;
  return (
    <div className="product-workspace-visual" aria-hidden="true">
      <div className="product-window">
        <div className="product-window-bar">
          <span className="product-window-dots"><i /><i /><i /></span>
          <span className="product-window-title">
            <Image src="/brand/mantou-assistant-icon.png" alt="" width={20} height={20} />
            {messages.site.name} <small>{messages.site.alternateName}</small>
          </span>
          <span className="product-window-actions">—　×</span>
        </div>
        <div className="product-window-body">
          <aside className="product-sidebar">
            <span className="is-active"><Smartphone size={14} />{copy.deviceOverview}</span>
            <span><History size={14} />{copy.appManagement}</span>
            <span><MapPin size={14} />{copy.location}</span>
            <span><FileKey2 size={14} />{copy.signing}</span>
          </aside>
          <div className="product-dashboard">
            <div className="product-device-row">
              <span className="product-device-icon"><Smartphone size={24} /></span>
              <span><strong>{copy.myDevice}</strong><small>{copy.iosVersion}</small></span>
              <em><CheckCircle2 size={14} /> {copy.connected}</em>
            </div>
            <div className="product-tool-grid">
              {copy.tiles.map((label, index) => {
                const Icon = TOOL_ICONS[index];
                const value = copy.tileMeta[index];
                return (
                <div key={label} className="product-tool-item">
                  <span><Icon size={17} /></span>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </div>
                );
              })}
            </div>
            <div className="product-storage">
              <span>{copy.deviceOverview}</span><small>{copy.toolsReady}</small><i />
            </div>
          </div>
        </div>
      </div>

      <div className="product-cable" />
      <div className="product-phone">
        <div className="product-phone-island" />
        <div className="product-phone-screen">
          <time>9:41</time>
          <div className="product-phone-orb">
            <Image src="/brand/mantou-assistant-icon.png" alt="" width={58} height={58} />
          </div>
          <strong>{copy.phoneReady}</strong>
          <span>{copy.connectionStable}</span>
          <div className="product-phone-status"><i />iOS 26.4</div>
        </div>
      </div>
    </div>
  );
}
