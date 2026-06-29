import { parseDMSToDecimal } from "../utils/helper.js";

/**
 * Extracts georeferenced vertices from an array of reconstructed PDF text lines.
 * 
 * @param {string[]} lines Array of reconstructed lines
 * @returns {{code: string, lon: number, lat: number}[]} Array of extracted vertices
 */
export function extractVerticesFromReconstructedLines(lines) {
    // 1. Join all lines with a space to create a single continuous stream
    let text = lines.join(" ");

    // 2. Normalize text to resolve layout wrapping and page-boundary splits
    // Merge dangling minus signs separated from the degree numbers by spaces
    text = text.replace(/-\s+(?=\d)/g, "-");

    // Merge line-wrapped or column-wrapped vertex codes (e.g. PHDR-P- 298 -> PHDR-P-298)
    text = text.replace(/(\b(?:[A-Z0-9_-]+-)?[PVMpv]{1,2}-)\s+(\d+)/gi, "$1$2");

    // Replace multiple spaces with a single space to clean up column alignments
    text = text.replace(/\s+/g, " ");

    // 3. Define a strict DMS pattern that REQUIRES symbols (degrees °, minutes ', seconds ")
    // This perfectly matches longitude and latitude while ignoring Azimuths (no seconds) and Distances (no symbols)
    // Supports variants of quotes like ” or '' or '
    const dmsRegexStr = `(?:[+-]?\\d+\\s*°\\s*\\d+\\s*['’´]\\s*\\d+(?:[,.]\\d+)?\\s*(?:["”]|''|'))`;
    
    // Vertex Code regex (e.g., PHDR-P-300, P-500, M-10, V-001, PV-100)
    // Code is followed by two strict DMS coordinates (longitude, then latitude)
    const vertexRegexStr = `(\\b(?:[A-Z0-9_-]+-)?[PVMpv]{1,2}-\\d+)\\s+(${dmsRegexStr})\\s+(${dmsRegexStr})`;
    const vertexRegex = new RegExp(vertexRegexStr, "gi");

    const vertices = [];
    const seenCodes = new Set();

    let match;
    while ((match = vertexRegex.exec(text)) !== null) {
        const rawCode = match[1].toUpperCase();
        const rawLon = match[2];
        const rawLat = match[3];

        const lon = parseDMSToDecimal(rawLon);
        const lat = parseDMSToDecimal(rawLat);

        // Skip if longitude or latitude is invalid
        if (lon === null || lat === null || isNaN(lon) || isNaN(lat)) {
            continue;
        }

        // Avoid adding the exact same vertex sequentially (sequential duplicates)
        if (vertices.length > 0) {
            const last = vertices[vertices.length - 1];
            if (last.code === rawCode || (Math.abs(last.lon - lon) < 1e-7 && Math.abs(last.lat - lat) < 1e-7)) {
                continue;
            }
        }

        vertices.push({
            code: rawCode,
            lon,
            lat
        });
        
        seenCodes.add(rawCode);
    }

    return vertices;
}
