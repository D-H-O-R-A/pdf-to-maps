import fs from "fs";

/**
 * Generates and saves a scalable vector SVG file matching the PNG map layout and proportions.
 * 
 * @param {any[]} vertices List of projected vertices (with utmX, utmY)
 * @param {string} outputPath Target path to save the .svg file
 * @param {number} [width=4000] SVG viewport width
 * @param {number} [height=4000] SVG viewport height
 * @param {number} [margin=100] Drawing margin
 */
export function exportSVG(vertices, outputPath, width = 4000, height = 4000, margin = 100) {
    // 1. Compute bounding box in meters
    const xs = vertices.map(v => v.utmX);
    const ys = vertices.map(v => v.utmY);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    // 2. Compute scale factor (pixels per meter) preserving aspect ratio
    const availableW = width - 2 * margin;
    const availableH = height - 2 * margin;

    const scale = Math.min(availableW / dx, availableH / dy);

    // 3. Compute centered offsets
    const px = dx * scale;
    const py = dy * scale;

    const offsetX = margin + (availableW - px) / 2;
    const offsetY = margin + (availableH - py) / 2;

    // Coordinate mapping functions
    // Note: UTM Y increases going up, so we invert Y on the SVG coordinate system
    const mapX = (x) => offsetX + (x - minX) * scale;
    const mapY = (y) => height - (offsetY + (y - minY) * scale);

    // 4. Construct SVG elements as XML strings
    let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    
    // Background rect
    svgContent += `  <rect width="${width}" height="${height}" fill="#ffffff" />\n`;

    // Polygon points string
    const pointsStr = vertices.map(v => `${mapX(v.utmX).toFixed(2)},${mapY(v.utmY).toFixed(2)}`).join(" ");

    // Draw main closed polygon
    svgContent += `  <polygon points="${pointsStr}" fill="rgba(52, 152, 219, 0.15)" stroke="#2c3e50" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />\n`;

    // Draw vertex circle dots and text labels
    for (const v of vertices) {
        const cx = mapX(v.utmX);
        const cy = mapY(v.utmY);

        // Circle node dot
        svgContent += `  <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="6" fill="#e74c3c" />\n`;

        // Text label (small gray)
        svgContent += `  <text x="${(cx + 10).toFixed(2)}" y="${(cy + 4).toFixed(2)}" fill="#7f8c8d" font-family="sans-serif" font-size="12">${v.code}</text>\n`;
    }

    svgContent += `</svg>\n`;

    fs.writeFileSync(outputPath, svgContent, "utf-8");
}
export default exportSVG;
