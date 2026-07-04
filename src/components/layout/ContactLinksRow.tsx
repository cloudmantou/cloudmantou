"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Github, Link2, Mail, MessageCircle, QrCode, Send, X } from "lucide-react";
import type { ContactLink, ContactLinkKind } from "@/lib/contact-links";

const kindIcons: Record<ContactLinkKind, typeof Mail> = {
  wechat_official: QrCode,
  wechat: MessageCircle,
  telegram: Send,
  email: Mail,
  github: Github,
  custom: Link2,
};

export function ContactLinksRow() {
  const [links, setLinks] = useState<ContactLink[]>([]);
  const [activeQr, setActiveQr] = useState<ContactLink | null>(null);

  useEffect(() => {
    fetch("/api/site/contact-links")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data)) setLinks(d.data);
      })
      .catch(() => {});
  }, []);

  if (links.length === 0) return null;

  return (
    <>
      <div className="social-row">
        {links.map((link) => {
          const FallbackIcon = kindIcons[link.kind];
          const content = link.iconUrl ? (
            <Image
              src={link.iconUrl}
              alt=""
              width={18}
              height={18}
              className="social-link-custom-icon"
              unoptimized
            />
          ) : (
            <FallbackIcon size={15} aria-hidden="true" />
          );

          if (link.qrImageUrl) {
            return (
              <button
                key={link.id}
                type="button"
                className="social-link"
                aria-label={link.label}
                title={link.label}
                onClick={() => setActiveQr(link)}
              >
                {content}
              </button>
            );
          }

          if (link.href) {
            const external = link.href.startsWith("http");
            return (
              <a
                key={link.id}
                className="social-link"
                href={link.href}
                aria-label={link.label}
                title={link.label}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {content}
              </a>
            );
          }

          return null;
        })}
      </div>

      {activeQr?.qrImageUrl ? (
        <div className="contact-qr-overlay" role="dialog" aria-modal="true" aria-label={activeQr.label}>
          <button
            type="button"
            className="contact-qr-backdrop"
            aria-label="关闭"
            onClick={() => setActiveQr(null)}
          />
          <div className="contact-qr-card">
            <button
              type="button"
              className="contact-qr-close"
              aria-label="关闭"
              onClick={() => setActiveQr(null)}
            >
              <X size={16} />
            </button>
            <p className="contact-qr-title">{activeQr.label}</p>
            <Image
              src={activeQr.qrImageUrl}
              alt={`${activeQr.label}二维码`}
              width={220}
              height={220}
              className="contact-qr-image"
              unoptimized
            />
            {activeQr.href ? (
              <a
                href={activeQr.href}
                className="contact-qr-link"
                {...(activeQr.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                打开链接
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}