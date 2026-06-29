import fs from "fs";

/**
 * Generates and saves a standard CAD DXF file containing a closed 2D POLYLINE in real-world meters (UTM coordinates).
 * Uses AC1009 (Release 12) format for maximum GIS/CAD compatibility.
 * 
 * @param {any[]} vertices List of projected vertices (with utmX, utmY)
 * @param {string} outputPath Target path to save the .dxf file
 */
export function exportDXF(vertices, outputPath) {
    let dxf = "";

    // 1. DXF Header Section
    dxf += "0\nSECTION\n";
    dxf += "2\nHEADER\n";
    dxf += "9\n$ACADVER\n";
    dxf += "1\nAC1009\n"; // Release 12 format
    dxf += "0\nENDSEC\n";

    // 2. DXF Entities Section
    dxf += "0\nSECTION\n";
    dxf += "2\nENTITIES\n";

    // Polyline header
    dxf += "0\nPOLYLINE\n";
    dxf += "8\nIMOV_LIMITE\n"; // Layer name: IMOV_LIMITE
    dxf += "66\n1\n";         // Vertices follow flag: 1 (true)
    dxf += "70\n1\n";         // Polyline flags: 1 = closed polyline

    // Add each vertex
    for (const v of vertices) {
        dxf += "0\nVERTEX\n";
        dxf += "8\nIMOV_LIMITE\n"; // Must match parent polyline layer
        dxf += `10\n${v.utmX.toFixed(4)}\n`; // X coordinate group
        dxf += `20\n${v.utmY.toFixed(4)}\n`; // Y coordinate group
        dxf += "30\n0.0\n";                 // Z coordinate group (2D = 0)
    }

    // Sequence end (SEQEND)
    dxf += "0\nSEQEND\n";
    dxf += "8\nIMOV_LIMITE\n";

    // Close Entities Section
    dxf += "0\nENDSEC\n";

    // 3. DXF End of File
    dxf += "0\nEOF\n";

    fs.writeFileSync(outputPath, dxf, "utf-8");
}
export default exportDXF;
