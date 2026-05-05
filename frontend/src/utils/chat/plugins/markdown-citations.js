/**
 * Markdown-it plugin for parsing inline citations and making them clickable.
 * Citations format: [[Source: Document Title]] or [[Source: Document Title, Page X]]
 * 
 * When clicked, these citations will trigger the document viewer to open.
 */

// Match citations with page numbers: [[Source: Title, Page X]] or [[Source: Title, Page X, Y]]
const CITATION_WITH_PAGE_REGEX = /\[\[Source:\s*(.+?),\s*Page\s*([\d,\s–-]+)\]\]/gi;

// Match citations without page numbers: [[Source: Title]]
const CITATION_NO_PAGE_REGEX = /\[\[Source:\s*([^\],]+)\]\]/gi;

/**
 * Extract the first page number from a page string like "17, 66" or "20–25"
 */
function extractFirstPage(pageStr) {
  if (!pageStr) return null;
  const match = pageStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Render a citation as a clickable element
 */
function renderCitation(title, pageStr) {
  const firstPage = extractFirstPage(pageStr);
  const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const displayPage = pageStr ? pageStr.trim() : null;
  const displayText = displayPage ? `📖 ${title}, Page ${displayPage}` : `📖 ${title}`;
  
  // Use a unique ID for each citation to attach event listener
  const citationId = `citation-${Math.random().toString(36).substr(2, 9)}`;
  
  return `<button type="button" id="${citationId}" class="citation-link cursor-pointer text-[#46c8ff] hover:text-[#46c8ff]/80 hover:underline inline-flex items-center gap-1 text-sm font-medium bg-transparent border-none p-0 m-0" data-citation="true" data-title="${safeTitle}" data-page="${firstPage || ''}" data-search-by-title="true">${displayText}</button>`;
}

/**
 * Process text and replace citations with clickable elements
 */
export function processCitations(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // First handle citations WITH page numbers
  result = result.replace(CITATION_WITH_PAGE_REGEX, (match, title, pageStr) => {
    return renderCitation(title.trim(), pageStr);
  });
  
  // Then handle citations WITHOUT page numbers
  // Make sure we don't re-process already rendered citations
  result = result.replace(CITATION_NO_PAGE_REGEX, (match, title) => {
    // Skip if already processed or if it's part of a larger citation
    if (result.includes(`data-title="${title.trim().replace(/"/g, '&quot;')}"`)) {
      return match;
    }
    return renderCitation(title.trim(), null);
  });
  
  return result;
}

/**
 * Set up global click handler for citations (call once on app init)
 */
let citationHandlerInitialized = false;

function initCitationClickHandler() {
  if (citationHandlerInitialized) return;
  citationHandlerInitialized = true;
  
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-citation="true"]');
    if (!target) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const title = target.getAttribute('data-title') || target.textContent;
    const pageStr = target.getAttribute('data-page');
    const page = pageStr ? parseInt(pageStr, 10) : null;
    const searchByTitle = target.getAttribute('data-search-by-title') === 'true';
    
    console.log('[Citation] Clicked:', { title, page, searchByTitle });
    
    // Dispatch event to open document viewer
    window.dispatchEvent(new CustomEvent('open_document_viewer', {
      detail: {
        title: title,
        pdfFilename: null,
        page: page,
        totalPages: null,
        highlightText: null,
        searchByTitle: searchByTitle
      }
    }));
  });
  
  console.log('[Citation] Global click handler initialized');
}

/**
 * Markdown-it plugin
 */
export default function markdownCitationsPlugin(md) {
  // Initialize click handler when plugin is loaded
  if (typeof document !== 'undefined') {
    // Delay initialization to ensure DOM is ready
    setTimeout(initCitationClickHandler, 100);
  }
  
  // Store the original text renderer
  const defaultRender = md.renderer.rules.text || function(tokens, idx) {
    return tokens[idx].content;
  };

  // Override the text renderer to process citations
  md.renderer.rules.text = function(tokens, idx, options, env, self) {
    const content = tokens[idx].content;
    
    // Check if content has citations (check both patterns)
    if (content && (content.includes('[[Source:') || content.includes('[[source:'))) {
      return processCitations(content);
    }
    
    return defaultRender(tokens, idx, options, env, self);
  };

  // Also handle inline HTML that might contain citations
  const defaultHtmlInline = md.renderer.rules.html_inline || function(tokens, idx) {
    return tokens[idx].content;
  };

  md.renderer.rules.html_inline = function(tokens, idx, options, env, self) {
    const content = tokens[idx].content;
    
    if (content && (content.includes('[[Source:') || content.includes('[[source:'))) {
      return processCitations(content);
    }
    
    return defaultHtmlInline(tokens, idx, options, env, self);
  };
}
