/**
 * Helper to map text chunks to their source page numbers.
 * Uses the pageData from PDF processing to determine which page(s) a chunk belongs to.
 */

/**
 * Find which page a character position belongs to
 * @param {number} charPosition - Character position in the full document text
 * @param {Array} pageData - Array of {pageNumber, charStart, charEnd} from PDF processing
 * @returns {number|null} - Page number or null if not found
 */
function getPageForPosition(charPosition, pageData) {
  if (!pageData || !Array.isArray(pageData) || pageData.length === 0) {
    return null;
  }

  for (const page of pageData) {
    if (charPosition >= page.charStart && charPosition < page.charEnd) {
      return page.pageNumber;
    }
  }

  // If position is beyond all pages, return last page
  const lastPage = pageData[pageData.length - 1];
  if (charPosition >= lastPage.charStart) {
    return lastPage.pageNumber;
  }

  return null;
}

/**
 * Find the character position of a chunk in the original document
 * @param {string} chunkText - The text of the chunk
 * @param {string} fullText - The full document text
 * @param {number} searchStartPos - Position to start searching from (for efficiency)
 * @returns {number} - Character position or -1 if not found
 */
function findChunkPosition(chunkText, fullText, searchStartPos = 0) {
  if (!chunkText || !fullText) return -1;
  
  // Clean up chunk text (remove any prefix metadata that might have been added)
  let cleanChunk = chunkText;
  
  // Remove common chunk prefixes like "Title: xxx\n" or "[Source: xxx]\n"
  const prefixMatch = cleanChunk.match(/^(?:\[.*?\]|\w+:.*?)\n/);
  if (prefixMatch) {
    cleanChunk = cleanChunk.substring(prefixMatch[0].length);
  }
  
  // Try to find the chunk in the full text
  // Start with exact match
  let pos = fullText.indexOf(cleanChunk, searchStartPos);
  
  if (pos === -1) {
    // Try with first 100 chars (chunks might have been modified)
    const searchStr = cleanChunk.substring(0, Math.min(100, cleanChunk.length));
    pos = fullText.indexOf(searchStr, searchStartPos);
  }
  
  if (pos === -1) {
    // Try with normalized whitespace
    const normalizedChunk = cleanChunk.replace(/\s+/g, ' ').substring(0, 100);
    const normalizedFull = fullText.replace(/\s+/g, ' ');
    pos = normalizedFull.indexOf(normalizedChunk);
  }
  
  return pos;
}

/**
 * Add page numbers to an array of text chunks based on their position in the original document
 * @param {string[]} chunks - Array of chunk texts
 * @param {string} fullText - The full document text (pageContent)
 * @param {Array} pageData - Array of {pageNumber, charStart, charEnd} from PDF processing
 * @returns {Array<{text: string, pageNumber: number|null}>} - Chunks with page numbers
 */
function mapChunksToPages(chunks, fullText, pageData) {
  if (!chunks || !Array.isArray(chunks)) return [];
  if (!pageData || !Array.isArray(pageData) || pageData.length === 0) {
    // No page data available, return chunks without page numbers
    return chunks.map(text => ({ text, pageNumber: null }));
  }

  const result = [];
  let searchPos = 0;

  for (const chunkText of chunks) {
    const charPos = findChunkPosition(chunkText, fullText, searchPos);
    const pageNumber = charPos >= 0 ? getPageForPosition(charPos, pageData) : null;
    
    result.push({
      text: chunkText,
      pageNumber: pageNumber,
      charPosition: charPos,
    });

    // Move search position forward for efficiency (chunks are usually sequential)
    if (charPos >= 0) {
      searchPos = charPos;
    }
  }

  return result;
}

/**
 * Enhance chunk metadata with page number information
 * @param {Object} metadata - Original chunk metadata
 * @param {number|null} pageNumber - Page number to add
 * @returns {Object} - Enhanced metadata with loc.pageNumber
 */
function enhanceMetadataWithPage(metadata, pageNumber) {
  if (pageNumber === null || pageNumber === undefined) {
    return metadata;
  }

  return {
    ...metadata,
    loc: {
      ...(metadata.loc || {}),
      pageNumber: pageNumber,
    },
    page_number: pageNumber, // Also store in a more accessible location
  };
}

module.exports = {
  getPageForPosition,
  findChunkPosition,
  mapChunksToPages,
  enhanceMetadataWithPage,
};
