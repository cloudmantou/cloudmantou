function inlineNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(inlineNode).join("").trim();

  switch (tag) {
    case "strong":
    case "b":
      return inner ? `**${inner}**` : "";
    case "em":
    case "i":
      return inner ? `*${inner}*` : "";
    case "code":
      return inner ? `\`${inner}\`` : "";
    case "a": {
      const href = el.getAttribute("href");
      return href && inner ? `[${inner}](${href})` : inner;
    }
    case "img": {
      const src = el.getAttribute("src");
      const alt = el.getAttribute("alt") || "image";
      return src ? `![${alt}](${src})` : "";
    }
    case "br":
      return "\n";
    case "span":
    case "font":
      return inner;
    default:
      return inner;
  }
}

function blockNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || "").trim();
    return text ? `${text}\n\n` : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "pre") {
    const code = el.querySelector("code");
    const langClass = code?.className.match(/language-([\w-]+)/)?.[1] || "";
    const text = (code?.textContent || el.textContent || "").replace(/\n$/, "");
    return `\`\`\`${langClass}\n${text}\n\`\`\`\n\n`;
  }

  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
    const level = Number(tag[1]);
    const text = Array.from(el.childNodes).map(inlineNode).join("").trim();
    return text ? `${"#".repeat(level)} ${text}\n\n` : "";
  }

  if (tag === "blockquote") {
    const text = Array.from(el.childNodes)
      .map(blockNode)
      .join("")
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return text ? `${text}\n\n` : "";
  }

  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    let index = 1;
    const items = Array.from(el.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((li) => {
        const text = Array.from(li.childNodes).map(inlineNode).join("").trim();
        const prefix = ordered ? `${index++}. ` : "- ";
        return `${prefix}${text}`;
      });
    return items.length ? `${items.join("\n")}\n\n` : "";
  }

  if (tag === "hr") return "---\n\n";

  if (tag === "p" || tag === "div" || tag === "section" || tag === "article") {
    const text = Array.from(el.childNodes).map(inlineNode).join("").trim();
    return text ? `${text}\n\n` : "";
  }

  if (tag === "img") {
    return `${inlineNode(el)}\n\n`;
  }

  return Array.from(el.childNodes).map(blockNode).join("");
}

/**
 * 将富文本 HTML 转为 Markdown（用于编辑器粘贴）
 */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const md = Array.from(doc.body.childNodes).map(blockNode).join("");
  return md.replace(/\n{3,}/g, "\n\n").trim();
}