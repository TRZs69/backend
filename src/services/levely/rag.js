class LevelyRag {
  static buildSnippet({ material, maxChars = 0 }) {
    const cleaned = stripHtml(material);
    if (!cleaned) {
      return '';
    }
    if (maxChars > 0 && cleaned.length > maxChars) {
      return `${cleaned.substring(0, maxChars).trim()}...`;
    }
    return cleaned;
  }
}

function stripHtml(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  let text = input.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  text = text.replace(/<\s*\/p\s*>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

module.exports = {
  LevelyRag,
};
