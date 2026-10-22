// A tiny, safe formatter. Creators type simple markers and nothing is ever turned into raw HTML:
//   **bold**   *italic*   [link text](https://example.com)   lines starting with "- " become bullets.
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
const BOLD = /\*\*([^\s*](?:[^*\n]*[^\s*])?)\*\*/;
const ITAL = /\*([^\s*](?:[^*\n]*[^\s*])?)\*/;

function inline(s) {
  const out = []; let rest = String(s);
  while (rest) {
    const found = [['a', LINK], ['b', BOLD], ['i', ITAL]].map(([t, re]) => { const m = re.exec(rest); return m ? { t, m } : null; }).filter(Boolean);
    if (!found.length) { out.push({ t: 'text', v: rest }); break; }
    found.sort((x, y) => x.m.index - y.m.index);
    const { t, m } = found[0];
    if (m.index > 0) out.push({ t: 'text', v: rest.slice(0, m.index) });
    if (t === 'a') out.push({ t: 'a', href: m[2], c: inline(m[1]) });
    else out.push({ t, c: inline(m[1]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseRich(src) {
  const blocks = []; let list = null;
  String(src == null ? '' : src).replace(/\r/g, '').split('\n').forEach((line) => {
    const m = /^\s*[-•]\s+(.*)$/.exec(line);
    if (m) { if (!list) { list = { type: 'ul', items: [] }; blocks.push(list); } list.items.push(inline(m[1])); }
    else { list = null; blocks.push({ type: 'line', c: inline(line) }); }
  });
  return blocks;
}
const flat = (nodes) => nodes.map((n) => (n.t === 'text' ? n.v : n.t === 'a' ? `${flat(n.c)} (${n.href})` : flat(n.c))).join('');
// Plain text with the markers removed, for exports and previews.
export const stripRich = (src) => parseRich(src).map((b) => (b.type === 'ul' ? b.items.map((i) => '• ' + flat(i)).join('\n') : flat(b.c))).join('\n');
// Wraps the selected text of a textarea with markers. Returns { value, start, end }.
export function applyFormat(value, start, end, kind, url) {
  const sel = value.slice(start, end);
  if (kind === 'bold' || kind === 'italic') {
    const mk = kind === 'bold' ? '**' : '*'; const body = sel || (kind === 'bold' ? 'bold text' : 'italic text');
    const v = value.slice(0, start) + mk + body + mk + value.slice(end);
    return { value: v, start: start + mk.length, end: start + mk.length + body.length };
  }
  if (kind === 'link') {
    const body = sel || 'link text'; const ins = `[${body}](${url})`;
    return { value: value.slice(0, start) + ins + value.slice(end), start: start + 1, end: start + 1 + body.length };
  }
  if (kind === 'bullet') {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1; let lineEnd = value.indexOf('\n', end); if (lineEnd < 0) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd).split('\n').map((l) => (/^\s*[-•]\s+/.test(l) ? l : '- ' + l)).join('\n');
    return { value: value.slice(0, lineStart) + block + value.slice(lineEnd), start: lineStart, end: lineStart + block.length };
  }
  return { value, start, end };
}
export const safeUrl = (u) => (/^https?:\/\/[^\s)]+$/i.test(String(u).trim()) ? String(u).trim() : null);
