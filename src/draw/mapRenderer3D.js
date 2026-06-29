import fs from "fs";
import { createCanvas } from "canvas";

/**
 * Renders a stunning high-resolution 3D isometric extruded map of the property.
 * 
 * @param {any[]} vertices List of projected vertices (with utmX, utmY)
 * @param {string} outputPath Target path to save the 3D PNG file
 * @param {number} [width=4000] Canvas width
 * @param {number} [height=4000] Canvas height
 */
export function renderPNGMap3D(vertices, outputPath, width = 4000, height = 4000) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Fill background with premium dark theme (#111827 - tailwind gray-900)
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, height);

    // 2. Compute 2D UTM bounding box
    const xs = vertices.map(v => v.utmX);
    const ys = vertices.map(v => v.utmY);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    // 3. Normalize coordinates to centered range [-1000, 1000]
    // This allows robust scaling in 3D space irrespective of UTM values
    const maxDim = Math.max(dx, dy);
    const normScale = 2000 / maxDim; // Map larger dimension to 2000 units wide

    const normalized = vertices.map(v => {
        return {
            ...v,
            nx: (v.utmX - (minX + dx / 2)) * normScale,
            ny: (v.utmY - (minY + dy / 2)) * normScale
        };
    });

    // 4. Isometric Projection Math
    // We rotate around Z-axis (Yaw) and then tilt around X-axis (Pitch)
    const yaw = -45 * Math.PI / 180;     // Rotate by -45 degrees
    const pitch = 35.264 * Math.PI / 180; // True isometric angle (sin(pitch) = tan(30deg))

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    // Scaling the projected 2D coordinates on the canvas
    const modelScale = 1.1; // Scale factor for canvas fit
    const hExtrude = 350;   // Extrusion height in pixels

    const project = (nx, ny, nz) => {
        // Rotate in 3D around Z
        const rx = nx * cosYaw - ny * sinYaw;
        const ry = nx * sinYaw + ny * cosYaw;
        
        // Project to screen 2D
        const u = width / 2 + rx * modelScale;
        // Invert Y because canvas coordinates increase downwards
        const v = height / 2 + ry * sinPitch * modelScale - nz;
        return { u, v };
    };

    // 5. Draw a gorgeous isometric background grid on the floor (z = -200)
    ctx.strokeStyle = "rgba(31, 41, 55, 0.6)"; // Dark grid lines (#1f2937)
    ctx.lineWidth = 2;
    const gridSize = 1500;
    const gridStep = 150;

    // Draw isometric grid lines
    for (let g = -gridSize; g <= gridSize; g += gridStep) {
        // Line along X axis
        const p1 = project(-gridSize, g, -200);
        const p2 = project(gridSize, g, -200);
        ctx.beginPath();
        ctx.moveTo(p1.u, p1.v);
        ctx.lineTo(p2.u, p2.v);
        ctx.stroke();

        // Line along Y axis
        const p3 = project(g, -gridSize, -200);
        const p4 = project(g, gridSize, -200);
        ctx.beginPath();
        ctx.moveTo(p3.u, p3.v);
        ctx.lineTo(p4.u, p4.v);
        ctx.stroke();
    }

    // 6. Draw floor shadow under the property (z = -200)
    // Draw semi-transparent black shadow of the property projected on the floor
    ctx.beginPath();
    normalized.forEach((v, idx) => {
        const p = project(v.nx, v.ny, -200);
        if (idx === 0) {
            ctx.moveTo(p.u, p.v);
        } else {
            ctx.lineTo(p.u, p.v);
        }
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.filter = "blur(30px)"; // Smooth soft shadow
    ctx.fill();
    ctx.filter = "none"; // Reset filter

    // 7. Draw Earth Crust Base Plane (z = 0)
    ctx.beginPath();
    normalized.forEach((v, idx) => {
        const p = project(v.nx, v.ny, 0);
        if (idx === 0) {
            ctx.moveTo(p.u, p.v);
        } else {
            ctx.lineTo(p.u, p.v);
        }
    });
    ctx.closePath();
    ctx.fillStyle = "#1e293b"; // Dark slate earthy base (#1e293b)
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 8. Draw Side Faces (Extruded Walls from z = 0 to z = hExtrude)
    // To draw them properly in correct 3D depth order, we shade and draw them one by one.
    // For each segment i -> i+1, we compute the 2D segment direction vector to shade based on light.
    // Standard lighting vector in normalized space: coming from top-left ([-1, 1])
    const lx = -0.707;
    const ly = 0.707;

    for (let i = 0; i < normalized.length - 1; i++) {
        const v1 = normalized[i];
        const v2 = normalized[i + 1];

        // 3D coordinates of face corners
        const pA = project(v1.nx, v1.ny, 0);         // Bottom-left
        const pB = project(v2.nx, v2.ny, 0);         // Bottom-right
        const pC = project(v2.nx, v2.ny, hExtrude);   // Top-right
        const pD = project(v1.nx, v1.ny, hExtrude);   // Top-left

        // Compute 2D segment normal vector for diffuse shading
        const dx_seg = v2.nx - v1.nx;
        const dy_seg = v2.ny - v1.ny;
        const len = Math.sqrt(dx_seg * dx_seg + dy_seg * dy_seg) || 1;
        
        // Face normal in horizontal plane (pointing outwards)
        const nx = dy_seg / len;
        const ny = -dx_seg / len;

        // Diffuse lighting intensity (dot product of normal with light vector)
        const dot = nx * lx + ny * ly;
        const intensity = 0.35 + 0.65 * (dot + 1) / 2; // Range [0.35, 1.0]

        // Elegant dark blue-gray extruded rock/terrain wall color
        // Base HSL hue: 215 (blue-gray). Lightness ranges from 12% to 45% based on intensity
        const lightness = Math.round(14 + 28 * intensity);
        ctx.fillStyle = `hsl(215, 25%, ${lightness}%)`;

        // Draw side panel
        ctx.beginPath();
        ctx.moveTo(pA.u, pA.v);
        ctx.lineTo(pB.u, pB.v);
        ctx.lineTo(pC.u, pC.v);
        ctx.lineTo(pD.u, pD.v);
        ctx.closePath();
        ctx.fill();

        // Stroke segment edges subtly to define structural block corners
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // 9. Draw Top Glowing Terrain Surface (z = hExtrude)
    ctx.beginPath();
    normalized.forEach((v, idx) => {
        const p = project(v.nx, v.ny, hExtrude);
        if (idx === 0) {
            ctx.moveTo(p.u, p.v);
        } else {
            ctx.lineTo(p.u, p.v);
        }
    });
    ctx.closePath();

    // Create luxurious linear gradient for the terrain top surface (emerald green to glowing teal)
    const pMin = project(-1000, -1000, hExtrude);
    const pMax = project(1000, 1000, hExtrude);
    const grad = ctx.createLinearGradient(pMin.u, pMin.v, pMax.u, pMax.v);
    grad.addColorStop(0, "rgba(16, 185, 129, 0.85)"); // Emerald green (#10b981)
    grad.addColorStop(1, "rgba(6, 182, 212, 0.85)");   // Cyber teal (#06b6d4)

    ctx.fillStyle = grad;
    ctx.fill();

    // Outline the top perimeter with a bright, crisp glowing green border
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 10. Draw 3D vertical corner lines (connecting base to top surface)
    // To keep it clean, we only draw these structural lines for every 10th vertex
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]); // Dotted line style

    normalized.forEach((v, idx) => {
        if (idx % 10 === 0 || idx === normalized.length - 1) {
            const pBase = project(v.nx, v.ny, 0);
            const pTop = project(v.nx, v.ny, hExtrude);
            ctx.beginPath();
            ctx.moveTo(pBase.u, pBase.v);
            ctx.lineTo(pTop.u, pTop.v);
            ctx.stroke();
        }
    });
    ctx.setLineDash([]); // Reset line dash

    // 11. Draw 3D Vertex indicator nodes and floating text labels
    // We only show labels for a subset (e.g. every 10th vertex) to prevent overlapping in dense polygons
    ctx.font = "bold 13px sans-serif";
    
    normalized.forEach((v, idx) => {
        const pTop = project(v.nx, v.ny, hExtrude);

        // Draw glowing red sphere dot for all vertices
        ctx.fillStyle = "#f43f5e"; // Glowing red (#f43f5e)
        ctx.beginPath();
        ctx.arc(pTop.u, pTop.v, 7, 0, Math.PI * 2);
        ctx.fill();

        // Subtle dark outline around the dot
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text floating label for every 10th vertex
        if (idx % 15 === 0 || idx === 0 || idx === normalized.length - 1) {
            // Text shadow/backing for readability
            ctx.fillStyle = "rgba(17, 24, 39, 0.8)";
            const textWidth = ctx.measureText(v.code).width;
            ctx.fillRect(pTop.u + 12, pTop.v - 13, textWidth + 10, 22);

            // Text label
            ctx.fillStyle = "#f3f4f6"; // Cyber gray/white
            ctx.fillText(v.code, pTop.u + 17, pTop.v + 3);
        }
    });

    // 12. Draw a luxury 3D Compass/Axes Indicator in the bottom-left corner
    const axOrigin = { u: 300, v: height - 300 };
    const axLen = 120;

    // Project X Axis (Easting - Red)
    const pX = { 
        u: axOrigin.u + axLen * cosYaw, 
        v: axOrigin.v + axLen * sinYaw * sinPitch 
    };
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(axOrigin.u, axOrigin.v);
    ctx.lineTo(pX.u, pX.v);
    ctx.stroke();
    ctx.fillStyle = "#f43f5e";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("E", pX.u + 10, pX.v + 5);

    // Project Y Axis (Northing - Green)
    // Remember UTM Y is north, which in our rotate goes other way
    const pY = { 
        u: axOrigin.u - axLen * sinYaw, 
        v: axOrigin.v + axLen * cosYaw * sinPitch 
    };
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(axOrigin.u, axOrigin.v);
    ctx.lineTo(pY.u, pY.v);
    ctx.stroke();
    ctx.fillStyle = "#10b981";
    ctx.fillText("N", pY.u + 10, pY.v + 5);

    // Project Z Axis (Elevation - Blue)
    const pZ = { u: axOrigin.u, v: axOrigin.v - axLen };
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(axOrigin.u, axOrigin.v);
    ctx.lineTo(pZ.u, pZ.v);
    ctx.stroke();
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Z", pZ.u - 5, pZ.v - 15);

    // Compass Label Title
    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px sans-serif";
    ctx.fillText("EIXOS DE PROJEÇÃO (3D)", axOrigin.u - 100, axOrigin.v + 45);

    // 13. Save Canvas to PNG
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);
}

export default renderPNGMap3D;
