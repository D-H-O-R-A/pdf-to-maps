import fs from "fs";
import path from "path";

/**
 * Converts a Degrees-Minutes-Seconds (DMS) coordinate string into decimal degrees.
 * Supports various formats:
 * - 61°22'48,222"
 * - 61°22'48.222"
 * - -61°22'48,222"
 * - -61 22 48.222
 * - 61 22 48.222
 * @param {string} str DMS Coordinate string
 * @returns {number|null} Decimal degrees or null if invalid
 */
export function parseDMSToDecimal(str) {
    if (!str) return null;

    // Clean up string: trim, replace sequential spaces with a single space, change comma to dot
    let clean = str.trim().replace(/\s+/g, ' ').replace(',', '.');

    // Regex for standard DMS coordinates (e.g., -61°22'48.222" or -61° 22' 48.222")
    // Degrees can be signed (- or +)
    // Degrees symbol: °
    // Minutes symbol: ' or ’ or ´
    // Seconds symbol: " or ” or '' or '
    const dmsRegex = /^([+-]?\d+)\s*°\s*(\d+)\s*['’´]\s*(\d+(?:\.\d+)?)\s*(?:["”]|''|')$/;
    const match = clean.match(dmsRegex);
    if (match) {
        const deg = Math.abs(parseFloat(match[1]));
        const min = parseFloat(match[2]);
        const sec = parseFloat(match[3]);

        if (isNaN(deg) || isNaN(min) || isNaN(sec)) {
            return null;
        }

        let decimal = deg + min / 60 + sec / 3600;
        if (match[1].startsWith("-")) {
            decimal = -decimal;
        }
        return decimal;
    }

    // Regex for space-separated coordinates (e.g., -61 22 48.222)
    const spaceRegex = /^([+-]?\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/;
    const spaceMatch = clean.match(spaceRegex);
    if (spaceMatch) {
        const deg = Math.abs(parseFloat(spaceMatch[1]));
        const min = parseFloat(spaceMatch[2]);
        const sec = parseFloat(spaceMatch[3]);

        if (isNaN(deg) || isNaN(min) || isNaN(sec)) {
            return null;
        }

        let decimal = deg + min / 60 + sec / 3600;
        if (spaceMatch[1].startsWith("-")) {
            decimal = -decimal;
        }
        return decimal;
    }

    // Regex for plain decimal coordinate (fallback)
    const decRegex = /^([+-]?\d+(?:\.\d+)?)$/;
    const decMatch = clean.match(decRegex);
    if (decMatch) {
        const val = parseFloat(decMatch[1]);
        return isNaN(val) ? null : val;
    }

    return null;
}

/**
 * Ensures that a directory exists, creating it recursively if needed.
 * @param {string} dirPath Folder path to create
 */
export function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Returns the base name of a file without its extension.
 * @param {string} filePath 
 * @returns {string} File name without extension
 */
export function getFileBaseName(filePath) {
    const ext = path.extname(filePath);
    return path.basename(filePath, ext);
}
