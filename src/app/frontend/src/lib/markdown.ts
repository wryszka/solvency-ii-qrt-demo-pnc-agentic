/**
 * Safe markdown-to-HTML renderer. Escapes HTML entities BEFORE applying
 * markdown transformations, preventing XSS from LLM output.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdownSafe(text: string): string {
  // 1. Escape all HTML first — this prevents XSS
  const escaped = escapeHtml(text);

  // 2. Apply markdown transformations on the safe string
  return escaped
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-4 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-gray-800 mt-3 mb-1">$1</h3>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-gray-700 mb-0.5">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm text-gray-700 mb-0.5">$1</li>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-gray-900">$1</strong>')
    // Tables: | header | header |
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) return ''; // separator row
      const tds = cells.map(c => `<td class="px-2 py-1 border-b border-gray-100 text-sm">${c.trim()}</td>`).join('');
      return `<tr class="border-b border-gray-100">${tds}</tr>`;
    })
    .replace(/\n\n/g, '<br/><br/>');
}
