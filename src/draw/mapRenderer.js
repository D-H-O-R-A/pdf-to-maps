import fs from "fs";
import { createCanvas } from "canvas";

/**
 * Renders a high-resolution PNG map from UTM projected vertices.
 * 
 * @param {any[]} vertices List of projected vertices (with utmX, utmY)
 * @param {string} outputPath Target path to save the PNG file
 * @param {number} [width=4000] Canvas width
 * @param {number} [height=4000] Canvas height
 * @param {number} [margin=100] Margin around the drawing
 */
export function renderPNGMap(vertices, outputPath, width = 4000, height = 4000, margin = 100) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Fill background with premium solid white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Compute bounding box in meters
    const xs = vertices.map(v => v.utmX);
    const ys = vertices.map(v => v.utmY);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    // 3. Compute scale factor (pixels per meter) preserving aspect ratio
    const availableW = width - 2 * margin;
    const availableH = height - 2 * margin;

    const scale = Math.min(availableW / dx, availableH / dy);

    // 4. Compute centered offsets to keep the drawing perfectly centered
    const px = dx * scale;
    const py = dy * scale;

    const offsetX = margin + (availableW - px) / 2;
    const offsetY = margin + (availableH - py) / 2;

    // Coordinate mapping functions
    // Note: UTM Y increases going up, so we invert Y on the canvas coordinate system
    const mapX = (x) => offsetX + (x - minX) * scale;
    const mapY = (y) => height - (offsetY + (y - minY) * scale);

    // 5. Draw the closed Polygon shape (Interior & Contour)
    ctx.beginPath();
    vertices.forEach((v, idx) => {
        const cx = mapX(v.utmX);
        const cy = mapY(v.utmY);
        if (idx === 0) {
            ctx.moveTo(cx, cy);
        } else {
            ctx.lineTo(cx, cy);
        }
    });
    ctx.closePath();

    // Fill interior with elegant semi-transparent blue
    ctx.fillStyle = "rgba(52, 152, 219, 0.15)";
    ctx.fill();

    // Outline contour with sleek dark slate/black line
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // 6. Draw each Vertex point and its text label
    // To prevent overlap rendering if there are thousands of vertices,
    // we use a clean small font size and standard offset
    ctx.font = "12px sans-serif";
    
    vertices.forEach(v => {
        const cx = mapX(v.utmX);
        const cy = mapY(v.utmY);

        // Draw vertex dot (red)
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw label (small gray)
        ctx.fillStyle = "#7f8c8d";
        ctx.fillText(v.code, cx + 10, cy + 4);
    });

    // 7. Save Canvas to PNG
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);
}
export default renderPNGMap;
