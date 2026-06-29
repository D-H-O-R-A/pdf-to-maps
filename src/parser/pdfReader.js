import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Reads a PDF file and reconstructs its lines page-by-page by grouping
 * text items that share a similar Y coordinate and sorting them by X coordinate.
 * It also filters out common digital signature footer noise.
 * 
 * @param {string} pdfPath Path to the PDF file
 * @returns {Promise<string[]>} Array of reconstructed text lines
 */
export async function readPDFAndReconstructLines(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const allLines = [];

    // Signature/validation noise regexes to remove
    const noisePatterns = [
        /Documento assinado/i,
        /Assinador ONR/i,
        /assinador\.onr\.org\.br/i,
        /validate\/[A-Z0-9-]+/i,
        /https:\/\/assinador/i
    ];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        // 1. Group items on the same line (similar Y-coordinates)
        // transform[5] is the Y-coordinate, transform[4] is the X-coordinate
        const rows = {};

        for (const item of content.items) {
            // Trim text and skip empty strings
            const strClean = item.str.trim();
            if (!strClean) continue;

            // Filter out signature/metadata noise
            const isNoise = noisePatterns.some(pattern => pattern.test(strClean));
            if (isNoise) continue;

            const y = item.transform[5];
            let grouped = false;

            // Search for an existing Y group within a 3.0 point tolerance (approx 3 pixels/points)
            for (const existingYStr of Object.keys(rows)) {
                const existingY = parseFloat(existingYStr);
                if (Math.abs(existingY - y) < 3.0) {
                    rows[existingYStr].push(item);
                    grouped = true;
                    break;
                }
            }

            if (!grouped) {
                rows[y] = [item];
            }
        }

        // 2. Sort Y-coordinates descending (top of the PDF page has a higher Y)
        const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);

        for (const y of sortedYs) {
            // Sort items in the same row from left to right (X ascending, transform[4])
            const rowItems = rows[y].sort((a, b) => a.transform[4] - b.transform[4]);
            
            // Reconstruct the line by joining items with spaces
            const lineText = rowItems.map(item => item.str.trim()).join(" ");
            if (lineText.trim()) {
                allLines.push(lineText);
            }
        }
    }

    return allLines;
}
