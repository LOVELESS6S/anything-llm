/**
 * Historical Date Extractor
 * 
 * Automatically extracts historical dates from document text using the system's
 * configured LLM provider. Uses PAGE-BY-PAGE extraction for 100% accurate
 * page number mapping.
 */

const { getLLMProvider } = require("../helpers");
const { safeJsonParse } = require("../http");
const { EventLogs } = require("../../models/eventLogs");

/**
 * The prompt template for extracting dates from a SINGLE PAGE.
 * Designed to capture ALL dated entries including diary entries, not just major historical events.
 */
const PAGE_EXTRACTION_PROMPT = `Extract ALL dates mentioned on this page. This includes:
- Diary entries (e.g., "October 1, 1950. Today I went to...")
- Historical events
- Any mention of specific dates

For EACH date found, provide:
1. The date in YYYY-MM-DD format (use YYYY-01-01 if only year known)
2. A brief summary of what is written about that date

IMPORTANT: Include personal diary entries, not just major historical events.

Return ONLY valid JSON:
{"dates": [{"date": "YYYY-MM-DD", "summary": "What is written about this date"}]}

If no dates found, return: {"dates": []}

Page content:
`;

/**
 * Extracts dates from a single page of text.
 * @param {string} pageContent - The page text
 * @param {number} pageNumber - The page number
 * @param {object} LLMConnector - The LLM provider instance
 * @returns {Promise<Array<{date: string, summary: string, page_number: number}>>}
 */
async function extractDatesFromPage(pageContent, pageNumber, LLMConnector) {
  if (!pageContent || pageContent.trim().length < 50) return [];
  
  try {
    const messages = [
      {
        role: "system",
        content: "You extract historical dates from text. Return ONLY valid JSON, nothing else."
      },
      {
        role: "user", 
        content: PAGE_EXTRACTION_PROMPT + pageContent
      }
    ];

    const { textResponse } = await LLMConnector.getChatCompletion(messages, {
      temperature: 0.1,
    });

    if (!textResponse) return [];

    // Parse JSON
    let jsonStr = textResponse.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = safeJsonParse(jsonStr, null);
    if (!result || !Array.isArray(result.dates)) return [];

    // Validate and tag with page number
    return result.dates
      .filter(d => d.date && d.summary && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map(d => ({
        date: d.date,
        summary: String(d.summary).substring(0, 500),
        page_number: pageNumber, // 100% accurate - we KNOW this came from this page
      }));
  } catch (e) {
    console.debug(`[HistoricalDateExtractor] Error on page ${pageNumber}:`, e.message);
    return [];
  }
}

/**
 * Extracts historical dates from document using PAGE-BY-PAGE processing.
 * This ensures 100% accurate page numbers because each date is extracted
 * directly from its source page.
 * 
 * @param {string} text - The full document text (used as fallback)
 * @param {object} options - Configuration options
 * @param {string} options.title - Document title for logging
 * @param {Array} options.pageData - Array of {pageNumber, content} objects
 * @param {number} options.totalPages - Total number of pages
 * @returns {Promise<{temporal_points: Array}>}
 */
async function extractHistoricalDates(text, options = {}) {
  const { title = "Unknown Document", pageData = null, totalPages = null } = options;
  
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    console.log(`[HistoricalDateExtractor] No text provided for "${title}", skipping.`);
    return null;
  }

  try {
    const llmProvider = process.env.LLM_PROVIDER;
    if (!llmProvider) {
      console.log(`[HistoricalDateExtractor] No LLM provider configured, skipping.`);
      return null;
    }

    const LLMConnector = getLLMProvider();
    let allDates = [];

    // PAGE-BY-PAGE EXTRACTION (preferred - 100% accurate page numbers)
    if (pageData && Array.isArray(pageData) && pageData.length > 0) {
      console.log(`[HistoricalDateExtractor] Processing "${title}" page-by-page (${pageData.length} pages)...`);
      
      // Process pages in batches to avoid rate limits
      const BATCH_SIZE = 5;
      for (let i = 0; i < pageData.length; i += BATCH_SIZE) {
        const batch = pageData.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(page => 
            extractDatesFromPage(page.content, page.pageNumber, LLMConnector)
          )
        );
        
        // Flatten and collect results
        for (const dates of batchResults) {
          allDates.push(...dates);
        }
        
        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < pageData.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`[HistoricalDateExtractor] Extracted ${allDates.length} dates from ${pageData.length} pages.`);
    } else {
      // FALLBACK: Process full text (no page numbers available)
      console.log(`[HistoricalDateExtractor] No pageData available, processing full text...`);
      
      const messages = [
        {
          role: "system",
          content: "You extract historical dates from text. Return ONLY valid JSON."
        },
        {
          role: "user", 
          content: PAGE_EXTRACTION_PROMPT + text.substring(0, 100000) // Limit to ~100k chars
        }
      ];

      const { textResponse } = await LLMConnector.getChatCompletion(messages, {
        temperature: 0.1,
      });

      if (textResponse) {
        let jsonStr = textResponse.trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        
        const result = safeJsonParse(jsonStr, null);
        if (result && Array.isArray(result.dates)) {
          allDates = result.dates
            .filter(d => d.date && d.summary && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
            .map(d => ({
              date: d.date,
              summary: String(d.summary).substring(0, 500),
              page_number: null, // No page data available
            }));
        }
      }
    }

    // Deduplicate by date+page+summary (keep different entries on different pages)
    const seen = new Set();
    const validatedPoints = allDates.filter(point => {
      // Include page number in key so same date on different pages is kept
      const key = `${point.date}|p${point.page_number}|${point.summary.substring(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[HistoricalDateExtractor] Final: ${validatedPoints.length} unique dates from "${title}".`);
    
    // Log to EventLogs so it shows in the UI
    if (validatedPoints.length > 0) {
      await EventLogs.logEvent("historical_dates_extracted", {
        documentTitle: title,
        datesExtracted: validatedPoints.length,
        dates: validatedPoints.map(p => ({ date: p.date, summary: p.summary })),
        llmProvider: process.env.LLM_PROVIDER || "unknown",
      });
    }
    
    return {
      temporal_points: validatedPoints,
      extracted_at: new Date().toISOString(),
      extraction_version: "1.0"
    };

  } catch (error) {
    // Fail silently - log error but don't stop document processing
    console.error(`[HistoricalDateExtractor] Error extracting dates from "${title}":`, error.message);
    
    // Log the failure to EventLogs
    await EventLogs.logEvent("historical_dates_extraction_failed", {
      documentTitle: title,
      error: error.message,
      llmProvider: process.env.LLM_PROVIDER || "unknown",
    });
    
    return null;
  }
}

/**
 * Checks if historical date extraction is enabled and available.
 * @returns {boolean}
 */
function isExtractionAvailable() {
  return !!process.env.LLM_PROVIDER;
}

module.exports = {
  extractHistoricalDates,
  isExtractionAvailable,
};
