import React from 'react';
import { parseRich } from '../lib/richtext.js';

const nodes = (list, k = '') => list.map((n, i) => {
  const key = k + i;
  if (n.t === 'text') return <React.Fragment key={key}>{n.v}</React.Fragment>;
  if (n.t === 'b') return <strong key={key}>{nodes(n.c, key + '.')}</strong>;
  if (n.t === 'i') return <em key={key}>{nodes(n.c, key + '.')}</em>;
  if (n.t === 'u') return <u key={key}>{nodes(n.c, key + '.')}</u>;
  if (n.t === 's') return <s key={key}>{nodes(n.c, key + '.')}</s>;
  return <a key={key} href={n.href} target="_blank" rel="noopener noreferrer">{nodes(n.c, key + '.')}</a>;
});
// Shows text that creators formatted with **bold**, *italic*, [links](https://…) and "- " bullets. Never injects HTML.
export function Rich({ text, inline }) {
  const blocks = parseRich(text);
  if (inline) return <>{blocks.map((b, i) => <React.Fragment key={i}>{i > 0 && ' '}{b.type === 'ul' ? b.items.map((it, j) => <React.Fragment key={j}>{j > 0 && ' · '}{nodes(it)}</React.Fragment>) : nodes(b.c)}</React.Fragment>)}</>;
  return <>{blocks.map((b, i) => (b.type === 'ul'
    ? <ul key={i} style={{ margin: '6px 0 6px 22px', padding: 0 }}>{b.items.map((it, j) => <li key={j}>{nodes(it)}</li>)}</ul>
    : b.c.length ? <div key={i}>{nodes(b.c)}</div> : <div key={i} style={{ height: '.7em' }} />))}</>;
}
