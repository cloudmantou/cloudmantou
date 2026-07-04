"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Github, Link2, Mail, MessageCircle, QrCode, Send, X } from "lucide-react";
import { extractEmailFromHref, type ContactLink, type ContactLinkKind } from "@/lib/contact-links";

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
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const copyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyHint = (message: string) => {
    if (copyHintTimer.current) clearTimeout(copyHintTimer.current);
    setCopyHint(message);
    copyHintTimer.current = setTimeout(() => setCopyHint(null), 2200);
  };

  const copyEmail = async (href: string) => {
    const email = extractEmailFromHref(href);
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      showCopyHint(`已复制 ${email}`);
    } catch {
      showCopyHint("复制失败，请手动复制");
    }
  };

  useEffect(() => {
    fetch("/api/site/contact-links")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data)) setLinks(d.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (copyHintTimer.current) clearTimeout(copyHintTimer.current);
    };
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
            if (link.kind === "email") {
              const email = extractEmailFromHref(link.href);
              return (
                <button
                  key={link.id}
                  type="button"
                  className="social-link"
                  aria-label={`复制${link.label}`}
                  title={email ? `点击复制：${email}` : link.label}
                  onClick={() => copyEmail(link.href!)}
                >
                  {content}
                </button>
              );
            }

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

      {copyHint ? (
        <p className="contact-copy-hint" role="status" aria-live="polite">
          {copyHint}
        </p>
      ) : null}

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