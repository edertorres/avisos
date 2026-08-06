/**
 * Strips all rich text formatting, HTML tags, and removes hard line breaks (\r\n, \n, \r),
 * un-hyphenates words broken at line ends, replaces tabs/extra spaces with a single space,
 * and trims leading/trailing whitespace.
 */
export function cleanPastedText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Join words broken by hyphens at end of line (e.g. "comuni-\ncación" or "comuni- \r\n cación")
    .replace(/(\b\w+)-\s*[\r\n]+\s*(\w+\b)/g, '$1$2')
    // Convert hard line breaks into a single space
    .replace(/[\r\n]+/g, ' ')
    // Replace tabs with spaces
    .replace(/\t+/g, ' ')
    // Collapse multiple consecutive spaces into a single space
    .replace(/ {2,}/g, ' ')
    .trim();
}
