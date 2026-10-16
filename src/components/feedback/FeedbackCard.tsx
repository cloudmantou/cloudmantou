"use client";
/* eslint-disable @next/next/no-img-element -- Private screenshots use browser session cookies; they are already compressed by Sharp. */
import Link from "next/link";
import { feedbackKindLabels, feedbackStatusLabels, type FeedbackItem } from "@/lib/feedback";
export function FeedbackCard({ item, showPost = false }: { item: FeedbackItem; showPost?: boolean }) {
  return <article className="feedback-card">
    <div className="feedback-meta"><span className={`feedback-status status-${item.status.toLowerCase()}`}>{feedbackStatusLabels[item.status]}</span><span>{feedbackKindLabels[item.kind]}</span><span>{item.user.nickname || item.user.username}</span><time>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</time>{!item.published && <span>仅本人及管理员可见</span>}</div>
    <h3>{item.title}</h3>{showPost && item.post && <Link className="feedback-link" href={`/post/${item.post.slug}#feedback`}>{item.post.title} ↗</Link>}
    <p className="feedback-description">{item.content}</p>
    {(item.appVersion || item.environment) && <p className="feedback-muted">{[item.appVersion && `版本 ${item.appVersion}`, item.environment].filter(Boolean).join(" · ")}</p>}
    {item.images.length > 0 && <div className="feedback-images">{item.images.map((image, i) => <a key={image.id} href={`/api/feedback/images/${image.id}`} target="_blank" rel="noreferrer" aria-label={`查看截图 ${i + 1}`}><img src={`/api/feedback/images/${image.id}`} alt={`反馈截图 ${i + 1}`} loading="lazy" /></a>)}</div>}
    <ol className="feedback-timeline">{item.events.map(event => <li key={event.id}><div><strong>{feedbackStatusLabels[event.status]}</strong> <time>{new Date(event.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>{event.awardedPoints > 0 && <span className="feedback-points"> +{event.awardedPoints} 积分</span>}</div><p>{event.note}</p></li>)}</ol>
    {item.status === "COMPLETED" && <p className="feedback-resolved">{item.resolvedVersion ? `已在 ${item.resolvedVersion} 完成` : "开发完成"} · 感谢 {item.user.nickname || item.user.username} 的反馈</p>}
  </article>;
}
