const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
  moveToOriginalPdfs,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const OCRLoader = require("../../../utils/OCRLoader");

async function asPdf({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  const pageData = []; // Store page-level data for metadata
  let docs = await pdfLoader.load();

  if (docs.length === 0) {
    console.log(
      `[asPDF] No text content found for ${filename}. Will attempt OCR parse.`
    );
    docs = await new OCRLoader({
      targetLanguages: options?.ocr?.langList,
    }).ocrPDF(fullFilePath);
  }

  for (const doc of docs) {
    const pageNum = doc.metadata?.loc?.pageNumber || "unknown";
    console.log(`-- Parsing content from pg ${pageNum} --`);
    if (!doc.pageContent || !doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
    // Store page data for later use
    pageData.push({
      pageNumber: pageNum,
      content: doc.pageContent,
      charStart: pageContent.slice(0, -1).join("").length,
      charEnd: pageContent.join("").length,
    });
  }

  if (!pageContent.length) {
    console.error(`[asPDF] Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  const docId = v4();
  const content = pageContent.join("");
  const pdfFilename = `${slugify(filename)}-${docId}.pdf`;
  
  // Get the created date BEFORE moving the file
  const publishedDate = createdDate(fullFilePath);
  
  // Move original PDF to permanent storage for viewing (this also removes from hotdir)
  const originalPdfFilename = moveToOriginalPdfs(fullFilePath, pdfFilename);
  
  // If move failed, trash the file manually
  if (!originalPdfFilename) {
    console.log(`[asPDF] Could not preserve original PDF, trashing...`);
    trashFile(fullFilePath);
  }
  
  const data = {
    id: docId,
    url: "file://" + fullFilePath,
    title: metadata.title || filename,
    docAuthor:
      metadata.docAuthor ||
      docs[0]?.metadata?.pdf?.info?.Creator ||
      "no author found",
    description:
      metadata.description ||
      docs[0]?.metadata?.pdf?.info?.Title ||
      "No description found.",
    docSource: metadata.docSource || "pdf file uploaded by the user.",
    chunkSource: metadata.chunkSource || "",
    published: publishedDate,
    wordCount: content.split(" ").length,
    pageContent: content,
    token_count_estimate: tokenizeString(content),
    // Store filename of original PDF for viewing (just the filename, not full path)
    originalPdfFilename: originalPdfFilename,
    totalPages: docs.length,
    pageData: pageData, // Store page mapping for navigation
  };

  const document = writeToServerDocuments({
    data,
    filename: `${slugify(filename)}-${data.id}`,
    options: { parseOnly: options.parseOnly },
  });
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [document] };
}

module.exports = asPdf;
