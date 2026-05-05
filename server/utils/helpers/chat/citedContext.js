/**
 * Formats context texts with source citations for LLM consumption.
 * This allows the LLM to cite specific sources with page numbers in its responses.
 * 
 * Page numbers are extracted from chunk metadata (loc.pageNumber or page_number),
 * which is populated during the embedding process using pageData from PDF processing.
 * 
 * @param {string[]} contextTexts - Array of context text content
 * @param {Object[]} sources - Array of source metadata objects
 * @returns {string[]} - Array of formatted context texts with source information
 */
function formatContextWithCitations(contextTexts = [], sources = []) {
  if (!contextTexts.length) return [];

  return contextTexts.map((text, i) => {
    const source = sources[i];
    if (!source) return text;

    // Extract source information - use clean title
    let title = source.title || source.docTitle || "Unknown Document";
    // Clean up title - remove file extensions and path prefixes
    title = title.replace(/\.(pdf|txt|docx?|md)$/i, '').replace(/^.*[\/\\]/, '');
    
    // Extract page number from chunk metadata
    const pageNumber = extractPageNumber(source);
    
    // Create citation header with page number if available
    let citationHeader = `[Source: ${title}`;
    if (pageNumber) {
      citationHeader += `, Page ${pageNumber}`;
    }
    citationHeader += `]`;
    
    // Return formatted text with citation header
    return `${citationHeader}\n${text}`;
  });
}

/**
 * Extract page number from various metadata formats
 * @param {Object} source - Source metadata object
 * @returns {number|null}
 */
function extractPageNumber(source) {
  if (!source) return null;
  
  // DEBUG: Log source structure to diagnose page number issues
  console.log(`[DEBUG extractPageNumber] Source keys:`, Object.keys(source));
  console.log(`[DEBUG extractPageNumber] loc:`, source.loc);
  console.log(`[DEBUG extractPageNumber] page_number:`, source.page_number);
  console.log(`[DEBUG extractPageNumber] text preview:`, source.text?.substring(0, 100));
  
  // Try various common page number fields
  if (source.loc?.pageNumber) {
    console.log(`[DEBUG] Found loc.pageNumber:`, source.loc.pageNumber);
    return source.loc.pageNumber;
  }
  if (source.metadata?.loc?.pageNumber) return source.metadata.loc.pageNumber;
  if (source.page_number) {
    console.log(`[DEBUG] Found page_number:`, source.page_number);
    return source.page_number;
  }
  if (source.pageNumber) return source.pageNumber;
  if (source.metadata?.page_number) return source.metadata.page_number;
  if (source.metadata?.pageNumber) return source.metadata.pageNumber;
  
  // Try to extract from chunkSource if it contains page info
  if (source.chunkSource && typeof source.chunkSource === 'string') {
    const pageMatch = source.chunkSource.match(/page[_-]?(\d+)/i);
    if (pageMatch) return parseInt(pageMatch[1], 10);
  }
  
  console.log(`[DEBUG] No page number found for source`);
  return null;
}

/**
 * Enhanced system prompt suffix that instructs the LLM to cite sources
 */
const CITATION_INSTRUCTION = `

When referencing information from the provided context, cite the source using this exact format: [[Source: Document Title, Page X]] if a page number is available, or [[Source: Document Title]] if not. This helps users verify and locate the original information.`;

/**
 * Get the citation instruction to append to system prompts
 * @returns {string}
 */
function getCitationInstruction() {
  return CITATION_INSTRUCTION;
}

module.exports = {
  formatContextWithCitations,
  extractPageNumber,
  getCitationInstruction,
};
