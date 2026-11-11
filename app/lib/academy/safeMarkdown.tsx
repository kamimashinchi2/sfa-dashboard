import type { ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="font-mono text-gold-soft">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const href = link?.[2] ?? "";
      if (/^https:\/\//.test(href)) {
        nodes.push(
          <a key={key} href={href} rel="noreferrer noopener" target="_blank">
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render a small Markdown subset as React nodes. Never injects raw HTML. */
export function SafeMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n").slice(0, 400);
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 ps-5">
        {list.map((item, idx) => (
          <li key={idx}>{inline(item, `${key}-${idx}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((line, idx) => {
    const bullet = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1] ?? "");
      return;
    }
    flush(`list-${idx}`);
    if (!line.trim()) return;
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={idx} className="font-display text-lg text-paper">
          {inline(line.slice(4), `h-${idx}`)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={idx} className="font-display text-xl text-paper">
          {inline(line.slice(3), `h-${idx}`)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={idx} className="font-display text-2xl text-paper">
          {inline(line.slice(2), `h-${idx}`)}
        </h2>,
      );
    } else {
      blocks.push(
        <p key={idx} className="text-sm text-fog">
          {inline(line, `p-${idx}`)}
        </p>,
      );
    }
  });
  flush("list-end");
  return <div className="space-y-2">{blocks}</div>;
}
