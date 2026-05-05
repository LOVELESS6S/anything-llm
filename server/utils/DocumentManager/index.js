const fs = require("fs");
const path = require("path");

const documentsPath =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, `../../storage/documents`)
    : path.resolve(process.env.STORAGE_DIR, `documents`);

class DocumentManager {
  constructor({ workspace = null, maxTokens = null }) {
    this.workspace = workspace;
    this.maxTokens = maxTokens || Number.POSITIVE_INFINITY;
    this.documentStoragePath = documentsPath;
  }

  log(text, ...args) {
    console.log(`\x1b[36m[DocumentManager]\x1b[0m ${text}`, ...args);
  }

  async pinnedDocuments() {
    if (!this.workspace) return [];
    const { Document } = require("../../models/documents");
    return await Document.where({
      workspaceId: Number(this.workspace.id),
      pinned: true,
    });
  }

  async pinnedDocs() {
    if (!this.workspace) return [];
    const docPaths = (await this.pinnedDocuments()).map((doc) => doc.docpath);
    if (docPaths.length === 0) return [];

    let tokens = 0;
    const pinnedDocs = [];
    for await (const docPath of docPaths) {
      try {
        const filePath = path.resolve(this.documentStoragePath, docPath);
        const data = JSON.parse(
          fs.readFileSync(filePath, { encoding: "utf-8" })
        );

        if (
          !data.hasOwnProperty("pageContent") ||
          !data.hasOwnProperty("token_count_estimate")
        ) {
          this.log(
            `Skipping document - Could not find page content or token_count_estimate in pinned source.`
          );
          continue;
        }

        if (tokens >= this.maxTokens) {
          this.log(
            `Skipping document - Token limit of ${this.maxTokens} has already been exceeded by pinned documents.`
          );
          continue;
        }

        pinnedDocs.push(data);
        tokens += data.token_count_estimate || 0;
      } catch {}
    }

    this.log(
      `Found ${pinnedDocs.length} pinned sources - prepending to content with ~${tokens} tokens of content.`
    );
    return pinnedDocs;
  }

  /**
   * Get pinned documents split by page for citation support.
   * This preserves the "always included" nature of pinned docs while enabling
   * page-level citations like unpinned documents from vector search.
   * 
   * If a document has pageData, each page becomes a separate chunk with its page number.
   * If no pageData exists, the document is returned as a single chunk (backwards compatible).
   * 
   * @returns {Promise<Array<{pageContent: string, loc?: {pageNumber: number}, ...metadata}>>}
   */
  async pinnedDocsWithPageChunks() {
    if (!this.workspace) return [];
    const docPaths = (await this.pinnedDocuments()).map((doc) => doc.docpath);
    if (docPaths.length === 0) return [];

    let tokens = 0;
    const pinnedChunks = [];
    
    for await (const docPath of docPaths) {
      try {
        const filePath = path.resolve(this.documentStoragePath, docPath);
        const data = JSON.parse(
          fs.readFileSync(filePath, { encoding: "utf-8" })
        );

        if (
          !data.hasOwnProperty("pageContent") ||
          !data.hasOwnProperty("token_count_estimate")
        ) {
          this.log(
            `Skipping document - Could not find page content or token_count_estimate in pinned source.`
          );
          continue;
        }

        if (tokens >= this.maxTokens) {
          this.log(
            `Skipping document - Token limit of ${this.maxTokens} has already been exceeded by pinned documents.`
          );
          continue;
        }

        const { pageContent, pageData, token_count_estimate, ...metadata } = data;

        // If document has pageData, split into page-level chunks for citations
        if (pageData && Array.isArray(pageData) && pageData.length > 0) {
          this.log(
            `Splitting pinned doc "${metadata.title || 'unknown'}" into ${pageData.length} page chunks for citations.`
          );
          
          for (const page of pageData) {
            if (!page.content || page.content.trim().length === 0) continue;
            
            pinnedChunks.push({
              pageContent: page.content,
              // Add loc.pageNumber for citation extraction (same format as vector search results)
              loc: { pageNumber: page.pageNumber },
              // Preserve all other metadata
              ...metadata,
              // Mark as pinned for identification
              isPinned: true,
            });
          }
        } else {
          // No pageData - return as single chunk (backwards compatible)
          this.log(
            `Pinned doc "${metadata.title || 'unknown'}" has no pageData - using as single chunk.`
          );
          pinnedChunks.push({
            pageContent,
            ...metadata,
            isPinned: true,
          });
        }

        tokens += token_count_estimate || 0;
      } catch (e) {
        this.log(`Error loading pinned document: ${e.message}`);
      }
    }

    this.log(
      `Found ${pinnedChunks.length} pinned page chunks - prepending to content with ~${tokens} tokens of content.`
    );
    return pinnedChunks;
  }
}

module.exports.DocumentManager = DocumentManager;
