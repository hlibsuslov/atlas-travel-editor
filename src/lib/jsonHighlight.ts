/**
 * Serialize a value to pretty JSON with syntax-highlighting markup. Output is
 * HTML-escaped first, then wrapped in <span class="k|s|n|b"> tokens, so it is
 * safe to inject via dangerouslySetInnerHTML.
 */
export function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'n';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'k' : 's';
      else if (/true|false|null/.test(match)) cls = 'b';
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
