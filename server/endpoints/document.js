const { Document } = require("../models/documents");
const { normalizePath, documentsPath, isWithin } = require("../utils/files");
const { reqBody } = require("../utils/http");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const fs = require("fs");
const path = require("path");

// Path to original PDFs storage
const originalPdfsPath =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../storage/original-pdfs")
    : path.resolve(process.env.STORAGE_DIR, "original-pdfs");

function documentEndpoints(app) {
  if (!app) return;

  /**
   * Serve an original PDF file for viewing
   * GET /document/pdf/:filename
   */
  app.get(
    "/document/pdf/:filename",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { filename } = request.params;
        const sanitizedFilename = normalizePath(filename);
        const pdfPath = path.join(originalPdfsPath, sanitizedFilename);

        // Security check - ensure path is within original-pdfs folder
        if (!isWithin(path.resolve(originalPdfsPath), path.resolve(pdfPath))) {
          return response.status(403).json({ 
            success: false, 
            error: "Access denied" 
          });
        }

        if (!fs.existsSync(pdfPath)) {
          return response.status(404).json({ 
            success: false, 
            error: "PDF file not found" 
          });
        }

        const stat = fs.statSync(pdfPath);
        
        response.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Length": stat.size,
          "Content-Disposition": `inline; filename="${sanitizedFilename}"`,
          "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        });

        const readStream = fs.createReadStream(pdfPath);
        readStream.pipe(response);
      } catch (e) {
        console.error("[PDF Serve Error]", e);
        response.status(500).json({ 
          success: false, 
          error: "Failed to serve PDF" 
        });
      }
    }
  );
  app.post(
    "/document/create-folder",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { name } = reqBody(request);
        const storagePath = path.join(documentsPath, normalizePath(name));
        if (!isWithin(path.resolve(documentsPath), path.resolve(storagePath)))
          throw new Error("Invalid folder name.");

        if (fs.existsSync(storagePath)) {
          response.status(500).json({
            success: false,
            message: "Folder by that name already exists",
          });
          return;
        }

        fs.mkdirSync(storagePath, { recursive: true });
        response.status(200).json({ success: true, message: null });
      } catch (e) {
        console.error(e);
        response.status(500).json({
          success: false,
          message: `Failed to create folder: ${e.message} `,
        });
      }
    }
  );

  app.post(
    "/document/move-files",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { files } = reqBody(request);
        const docpaths = files.map(({ from }) => from);
        const documents = await Document.where({ docpath: { in: docpaths } });

        const embeddedFiles = documents.map((doc) => doc.docpath);
        const moveableFiles = files.filter(
          ({ from }) => !embeddedFiles.includes(from)
        );

        const movePromises = moveableFiles.map(({ from, to }) => {
          const sourcePath = path.join(documentsPath, normalizePath(from));
          const destinationPath = path.join(documentsPath, normalizePath(to));

          return new Promise((resolve, reject) => {
            if (
              !isWithin(documentsPath, sourcePath) ||
              !isWithin(documentsPath, destinationPath)
            )
              return reject("Invalid file location");

            fs.rename(sourcePath, destinationPath, (err) => {
              if (err) {
                console.error(`Error moving file ${from} to ${to}:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });

        Promise.all(movePromises)
          .then(() => {
            const unmovableCount = files.length - moveableFiles.length;
            if (unmovableCount > 0) {
              response.status(200).json({
                success: true,
                message: `${unmovableCount}/${files.length} files not moved. Unembed them from all workspaces.`,
              });
            } else {
              response.status(200).json({
                success: true,
                message: null,
              });
            }
          })
          .catch((err) => {
            console.error("Error moving files:", err);
            response
              .status(500)
              .json({ success: false, message: "Failed to move some files." });
          });
      } catch (e) {
        console.error(e);
        response
          .status(500)
          .json({ success: false, message: "Failed to move files." });
      }
    }
  );
}

module.exports = { documentEndpoints };
