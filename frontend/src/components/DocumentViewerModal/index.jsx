import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { 
  X, 
  CaretLeft, 
  CaretRight, 
  MagnifyingGlass,
  FileText,
  FilePdf,
  ArrowsOutSimple,
  ArrowsInSimple,
  DownloadSimple,
  Spinner,
  Warning,
} from "@phosphor-icons/react";
import ModalWrapper from "@/components/ModalWrapper";
import { fullApiUrl } from "@/utils/constants";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * DocumentViewerModal - A modal for viewing PDF documents with page navigation
 * 
 * Supports:
 * - Actual PDF rendering with react-pdf
 * - Page navigation
 * - Zoom controls
 * - Text fallback when PDF is not available
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Callback when modal is closed
 * @param {string} props.title - Document title
 * @param {string} props.pdfFilename - Filename of the PDF (e.g., "document-abc123.pdf")
 * @param {Array} props.chunks - Array of chunk objects for text fallback
 * @param {number} props.initialPage - Page to open to (1-based)
 * @param {number} props.totalPages - Total number of pages in the document
 * @param {string} props.highlightText - Text to highlight in text view
 */
export default function DocumentViewerModal({ 
  isOpen, 
  onClose, 
  title = "Document", 
  pdfFilename = null,
  chunks = [],
  initialPage = 1,
  totalPages = null,
  highlightText = null,
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const containerRef = useRef(null);

  // Construct the PDF URL from the filename using full API URL
  const pdfUrl = useMemo(() => {
    if (!pdfFilename) return null;
    return `${fullApiUrl()}/document/pdf/${encodeURIComponent(pdfFilename)}`;
  }, [pdfFilename]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(initialPage || 1);
      setPdfError(null);
      setIsLoading(true);
      setShowTextFallback(!pdfFilename);
    }
  }, [isOpen, initialPage, pdfFilename]);

  // Handle PDF load success
  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setPdfError(null);
    console.log(`[PDFViewer] Loaded PDF with ${numPages} pages`);
  }, []);

  // Handle PDF load error
  const onDocumentLoadError = useCallback((error) => {
    console.error("[PDFViewer] Error loading PDF:", error);
    setPdfError(error.message || "Failed to load PDF");
    setIsLoading(false);
    setShowTextFallback(true);
  }, []);

  // Page navigation
  const goToPage = useCallback((page) => {
    const maxPages = numPages || totalPages || 1;
    const targetPage = Math.max(1, Math.min(page, maxPages));
    setCurrentPage(targetPage);
  }, [numPages, totalPages]);

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  // Zoom controls
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3.0));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevPage();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentPage, isFullscreen]);

  // Highlight text in content (for text fallback mode)
  const highlightContent = useCallback((text) => {
    if (!text || !highlightText) return text;
    
    const escapedHighlight = highlightText.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedHighlight})`, "gi");
    return text.replace(regex, '<mark class="bg-[#46c8ff]/30 text-white px-0.5 rounded border border-[#46c8ff]/50">$1</mark>');
  }, [highlightText]);

  if (!isOpen) return null;

  const maxPages = numPages || totalPages || 1;

  return (
    <ModalWrapper isOpen={isOpen}>
      <div 
        className={`bg-theme-bg-secondary rounded-lg shadow border-2 border-theme-modal-border overflow-hidden flex flex-col transition-all duration-300 ${
          isFullscreen 
            ? "fixed inset-4 z-[100] max-w-none max-h-none" 
            : "w-full max-w-5xl max-h-[90vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-modal-border bg-theme-bg-container shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {pdfFilename && !showTextFallback ? (
              <FilePdf size={24} weight="fill" className="text-red-400 shrink-0" />
            ) : (
              <FileText size={24} className="text-theme-text-secondary shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white truncate">
                {title}
              </h3>
              {maxPages > 0 && (
                <p className="text-xs text-theme-text-secondary">
                  {showTextFallback ? "Text View" : "PDF View"} • {maxPages} pages
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Toggle view mode */}
            {pdfFilename && chunks.length > 0 && (
              <button
                onClick={() => setShowTextFallback(!showTextFallback)}
                className="px-2 py-1 rounded text-xs text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
                title={showTextFallback ? "Switch to PDF view" : "Switch to text view"}
              >
                {showTextFallback ? "📄 PDF" : "📝 Text"}
              </button>
            )}
            
            {/* Zoom controls (PDF mode only) */}
            {!showTextFallback && pdfFilename && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
                  title="Zoom out"
                >
                  −
                </button>
                <span className="text-xs text-theme-text-secondary min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={resetZoom}
                  className="px-2 py-1 rounded text-xs text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
                  title="Reset zoom"
                >
                  Fit
                </button>
              </>
            )}

            <div className="w-px h-5 bg-theme-sidebar-border mx-1" />
            
            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <ArrowsInSimple size={18} /> : <ArrowsOutSimple size={18} />}
            </button>

            {/* Download (if PDF available) */}
            {pdfUrl && !pdfError && (
              <a
                href={pdfUrl}
                download={title}
                className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white transition-colors"
                title="Download PDF"
              >
                <DownloadSimple size={18} />
              </a>
            )}
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-red-500/20 hover:text-red-400 transition-colors ml-1"
              title="Close"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
        </div>

        {/* Page navigation bar */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-theme-modal-border bg-theme-bg-secondary/50 shrink-0">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <CaretLeft size={16} weight="bold" />
            Prev
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-text-secondary">Page</span>
            <input
              type="number"
              min={1}
              max={maxPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 bg-theme-bg-container border border-theme-sidebar-border rounded text-sm text-white text-center focus:outline-none focus:border-[#46c8ff]/50"
            />
            <span className="text-sm text-theme-text-secondary">of {maxPages}</span>
          </div>
          
          <button
            onClick={nextPage}
            disabled={currentPage >= maxPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm text-theme-text-secondary hover:bg-theme-sidebar-item-hover hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        {/* Content area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-neutral-900/50"
          style={{ minHeight: "400px" }}
        >
          {showTextFallback || !pdfUrl ? (
            // Text fallback view
            <div className="p-6 space-y-4">
              {pdfError && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm mb-4">
                  <Warning size={18} weight="fill" />
                  <span>PDF not available: {pdfError}. Showing text content instead.</span>
                </div>
              )}
              
              {chunks.length > 0 ? (
                chunks.map((chunk, idx) => {
                  const pageNum = getPageFromChunk(chunk);
                  const isCurrentPage = pageNum === currentPage || (!pageNum && idx === 0);
                  
                  return (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg ${
                        isCurrentPage 
                          ? "bg-[#46c8ff]/10 border border-[#46c8ff]/30" 
                          : "bg-theme-bg-container"
                      }`}
                    >
                      {pageNum && (
                        <div className="text-xs text-theme-text-secondary mb-2">
                          Page {pageNum}
                        </div>
                      )}
                      <div 
                        className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightContent(chunk.text || chunk.pageContent || "") 
                        }}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-theme-text-secondary">
                  <FileText size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No content available</p>
                </div>
              )}
            </div>
          ) : (
            // PDF viewer
            <div className="flex justify-center p-4">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-theme-bg-secondary/80 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner size={32} className="text-[#46c8ff] animate-spin" />
                    <span className="text-sm text-theme-text-secondary">Loading PDF...</span>
                  </div>
                </div>
              )}
              
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                className="flex justify-center"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-xl"
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Spinner size={24} className="text-[#46c8ff] animate-spin" />
                    </div>
                  }
                />
              </Document>
            </div>
          )}
        </div>

        {/* Footer with page indicator */}
        {initialPage && initialPage !== 1 && (
          <div className="px-4 py-2 border-t border-theme-modal-border bg-theme-bg-container/50 text-center shrink-0">
            <span className="text-xs text-[#46c8ff]">
              Opened to page {initialPage}
              {highlightText && ` • Related to: "${highlightText.substring(0, 40)}..."`}
            </span>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

// Helper to extract page number from chunk metadata
export function getPageFromChunk(chunk) {
  if (!chunk) return null;
  
  if (chunk.metadata?.loc?.pageNumber) return chunk.metadata.loc.pageNumber;
  if (chunk.metadata?.page_number) return chunk.metadata.page_number;
  if (chunk.loc?.pageNumber) return chunk.loc.pageNumber;
  if (chunk.page_number) return chunk.page_number;
  if (chunk.pageNumber) return chunk.pageNumber;
  
  return null;
}

// Export helper to dispatch document viewer event
export function openDocumentViewer(title, pdfFilename, page = null, totalPages = null) {
  window.dispatchEvent(new CustomEvent("open_document_viewer", {
    detail: { title, pdfFilename, page, totalPages }
  }));
}

/**
 * GlobalDocumentViewer - A self-contained document viewer that listens for global events
 * Add this component once at the app root level (App.jsx) to enable document viewing from anywhere
 * 
 * Supports two modes:
 * 1. Direct: when pdfFilename is provided
 * 2. Search by title: when searchByTitle is true, looks up document by title
 */
export function GlobalDocumentViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [viewerProps, setViewerProps] = useState({
    title: "",
    pdfFilename: null,
    initialPage: 1,
    totalPages: null,
    chunks: [],
    highlightText: null,
  });

  // Listen for global document viewer events
  useEffect(() => {
    const handleOpenViewer = async (event) => {
      const { 
        title, 
        pdfFilename, 
        page, 
        totalPages, 
        chunks, 
        highlight,
        highlightText,
        searchByTitle = false 
      } = event.detail || {};
      
      console.log("[GlobalDocumentViewer] Opening:", { title, pdfFilename, page, searchByTitle });
      
      // If searchByTitle is true and we don't have a pdfFilename, 
      // try to find the document by title from stored documents
      let resolvedPdfFilename = pdfFilename;
      let resolvedTotalPages = totalPages;
      
      if (searchByTitle && !pdfFilename && title) {
        setIsSearching(true);
        try {
          // Try to find the PDF from localStorage cache of workspace documents
          const cachedDocs = findDocumentByTitle(title);
          if (cachedDocs) {
            resolvedPdfFilename = cachedDocs.pdfFilename;
            resolvedTotalPages = cachedDocs.totalPages || totalPages;
            console.log("[GlobalDocumentViewer] Found document by title:", cachedDocs);
          }
        } catch (e) {
          console.error("[GlobalDocumentViewer] Error searching by title:", e);
        }
        setIsSearching(false);
      }
      
      setViewerProps({
        title: title || "Document",
        pdfFilename: resolvedPdfFilename || null,
        initialPage: page || 1,
        totalPages: resolvedTotalPages || null,
        chunks: chunks || [],
        highlightText: highlight || highlightText || null,
      });
      setIsOpen(true);
    };

    window.addEventListener("open_document_viewer", handleOpenViewer);
    return () => window.removeEventListener("open_document_viewer", handleOpenViewer);
  }, []);

  return (
    <DocumentViewerModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={viewerProps.title}
      pdfFilename={viewerProps.pdfFilename}
      initialPage={viewerProps.initialPage}
      totalPages={viewerProps.totalPages}
      chunks={viewerProps.chunks}
      highlightText={viewerProps.highlightText}
    />
  );
}

/**
 * Try to find a document's PDF filename by its title
 * Searches through cached workspace document metadata
 */
function findDocumentByTitle(searchTitle) {
  if (!searchTitle) return null;
  
  try {
    // Normalize the search title - remove .pdf extension and special chars for matching
    const normalizedSearch = searchTitle
      .toLowerCase()
      .trim()
      .replace(/\.pdf$/i, '')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ');
    
    console.log("[findDocumentByTitle] Searching for:", normalizedSearch);
    
    // Helper to check if titles match
    const titlesMatch = (docTitle) => {
      if (!docTitle) return false;
      const normalizedDoc = docTitle
        .toLowerCase()
        .trim()
        .replace(/\.pdf$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ');
      
      // Check various match conditions
      return normalizedDoc === normalizedSearch ||
             normalizedDoc.includes(normalizedSearch) ||
             normalizedSearch.includes(normalizedDoc) ||
             // Also check if significant words match
             normalizedSearch.split(' ').filter(w => w.length > 3).every(word => normalizedDoc.includes(word));
    };
    
    // First check the current workspace's timeline data (most likely to be correct)
    const timelineData = window.__workspaceDocuments__;
    if (Array.isArray(timelineData)) {
      console.log("[findDocumentByTitle] Checking timeline data with", timelineData.length, "docs");
      for (const doc of timelineData) {
        const docTitle = doc.title || doc.name || doc.filename || '';
        if (titlesMatch(docTitle)) {
          const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
          console.log("[findDocumentByTitle] Found match in timeline:", docTitle);
          return {
            pdfFilename: metadata?.originalPdfFilename || null,
            totalPages: metadata?.totalPages || null,
            title: docTitle,
          };
        }
      }
    }
    
    // Search through localStorage for workspace document caches
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.includes('workspace')) continue;
      
      try {
        const data = localStorage.getItem(key);
        if (!data) continue;
        
        const parsed = JSON.parse(data);
        const docs = Array.isArray(parsed) ? parsed : (parsed.documents || parsed.items || []);
        
        for (const doc of docs) {
          const docTitle = doc.title || doc.name || doc.filename || '';
          if (titlesMatch(docTitle)) {
            const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
            console.log("[findDocumentByTitle] Found match in localStorage:", docTitle);
            return {
              pdfFilename: metadata?.originalPdfFilename || null,
              totalPages: metadata?.totalPages || null,
              title: docTitle,
            };
          }
        }
      } catch (e) {
        // Skip malformed cache entries
        continue;
      }
    }
    
    console.log("[findDocumentByTitle] No match found for:", searchTitle);
    return null;
  } catch (e) {
    console.error("[findDocumentByTitle] Error:", e);
    return null;
  }
}
