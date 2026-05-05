/**
 * Page-Based Text Splitter
 * 
 * Instead of splitting the entire document and trying to map chunks back to pages,
 * this splits each page separately and tags each chunk with its source page number.
 * 
 * This guarantees 100% accurate page numbers for PDF citations.
 */

const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");

/**
 * Split document by pages first, then split each page into chunks.
 * Each chunk is tagged with its source page number.
 * 
 * @param {string} fullText - The full document text (for fallback)
 * @param {Array} pageData - Array of {pageNumber, content, charStart, charEnd}
 * @param {Object} options - Splitter options
 * @param {number} options.chunkSize - Maximum chunk size
 * @param {number} options.chunkOverlap - Overlap between chunks
 * @returns {Array<{text: string, pageNumber: number}>}
 */
async function splitByPages(fullText, pageData, options = {}) {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
  } = options;

  // If no pageData, fall back to regular splitting without page numbers
  if (!pageData || !Array.isArray(pageData) || pageData.length === 0) {
    console.log("[PageBasedSplitter] No pageData available, falling back to regular splitting");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    const chunks = await splitter.splitText(fullText);
    return chunks.map(text => ({ text, pageNumber: null }));
  }

  console.log(`[PageBasedSplitter] Splitting ${pageData.length} pages with chunkSize=${chunkSize}`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const allChunks = [];

  for (const page of pageData) {
    const pageContent = page.content;
    const pageNumber = page.pageNumber;

    if (!pageContent || pageContent.trim().length === 0) {
      continue;
    }

    // If page content is smaller than chunk size, keep it as one chunk
    if (pageContent.length <= chunkSize) {
      allChunks.push({
        text: pageContent,
        pageNumber: pageNumber,
      });
    } else {
      // Split this page's content into chunks
      const pageChunks = await splitter.splitText(pageContent);
      for (const chunkText of pageChunks) {
        allChunks.push({
          text: chunkText,
          pageNumber: pageNumber,
        });
      }
    }
  }

  console.log(`[PageBasedSplitter] Created ${allChunks.length} chunks from ${pageData.length} pages`);
  
  // Log distribution of chunks per page for verification
  const pageDistribution = {};
  allChunks.forEach(c => {
    pageDistribution[c.pageNumber] = (pageDistribution[c.pageNumber] || 0) + 1;
  });
  const samplePages = Object.entries(pageDistribution).slice(0, 5);
  console.log(`[PageBasedSplitter] Sample distribution: ${samplePages.map(([p, c]) => `Page ${p}: ${c} chunks`).join(', ')}`);

  return allChunks;
}

/**
 * Wrapper that returns just the text array for compatibility with existing code,
 * but also returns pageNumbers array that can be used to enhance metadata.
 * 
 * @param {string} fullText - The full document text
 * @param {Array} pageData - Array of page data
 * @param {Object} options - Splitter options
 * @returns {{texts: string[], pageNumbers: (number|null)[]}}
 */
async function splitByPagesCompatible(fullText, pageData, options = {}) {
  const chunks = await splitByPages(fullText, pageData, options);
  return {
    texts: chunks.map(c => c.text),
    pageNumbers: chunks.map(c => c.pageNumber),
  };
}

module.exports = {
  splitByPages,
  splitByPagesCompatible,
};
