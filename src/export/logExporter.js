import fs from "fs";
import * as turf from "@turf/turf";

/**
 * Computes polygon stats (Area, Perimeter) using Turf.js and generates a detailed log.txt.
 * 
 * @param {any[]} vertices List of closed vertices (with lon, lat, utmX, utmY)
 * @param {number} zone UTM Zone detected
 * @param {boolean} isSouth Hemisphere detected (true if South)
 * @param {number} processingTimeMs Duration of processing in milliseconds
 * @param {string[]} errors List of warning/error messages encountered
 * @param {string} outputPath Target path to save log.txt
 */
export function exportLog(vertices, zone, isSouth, processingTimeMs, errors, outputPath) {
    // 1. Convert vertices to Turf.js Polygon
    // coordinates must be closed [[ [lon1, lat1], ..., [lon1, lat1] ]]
    const coords = vertices.map(v => [v.lon, v.lat]);
    const poly = turf.polygon([coords]);

    // 2. Calculate Geodesic Area on the sphere (returns square meters)
    const areaM2 = turf.area(poly);
    const areaHa = areaM2 / 10000; // 1 Hectare = 10,000 square meters

    // 3. Calculate Geodesic Perimeter on the sphere
    // Turf length of a polygon gets the length of its boundary.
    // To ensure compatibility with different Turf.js versions, we compute kilometers and convert to meters
    const lengthKm = turf.length(poly, { units: "kilometers" });
    const perimeterM = lengthKm * 1000;

    // 4. Compute Bounding Boxes
    const lons = vertices.map(v => v.lon);
    const lats = vertices.map(v => v.lat);
    const utmXs = vertices.map(v => v.utmX);
    const utmYs = vertices.map(v => v.utmY);

    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const minX = Math.min(...utmXs);
    const maxX = Math.max(...utmXs);
    const minY = Math.min(...utmYs);
    const maxY = Math.max(...utmYs);

    // 5. Construct Log Output
    let log = "========================================================\n";
    log += "SIGEF PDF GEOPROCESSOR - PARSING LOG\n";
    log += "========================================================\n\n";
    
    log += `Data de Processamento: ${new Date().toLocaleString("pt-BR")}\n`;
    log += `Tempo de Processamento: ${processingTimeMs.toFixed(2)} ms\n`;
    log += `Zona UTM Detectada: ${zone}${isSouth ? "S" : "N"}\n`;
    log += `Quantidade de Vértices: ${vertices.length} (incluindo fechamento)\n\n`;

    log += "--------------------------------------------------------\n";
    log += "DIMENSÕES E ÁREA DO IMÓVEL (Estatísticas Geodésicas)\n";
    log += "--------------------------------------------------------\n";
    log += `Área Estimada: ${areaHa.toFixed(4)} ha (${areaM2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²)\n`;
    log += `Perímetro: ${perimeterM.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m\n\n`;

    log += "--------------------------------------------------------\n";
    log += "BOUNDING BOX (Caixa Envolvente)\n";
    log += "--------------------------------------------------------\n";
    log += "Coordenadas Geográficas (Graus Decimais):\n";
    log += `  Longitude Mínima (Oeste): ${minLon.toFixed(8)}°\n`;
    log += `  Longitude Máxima (Leste): ${maxLon.toFixed(8)}°\n`;
    log += `  Latitude Mínima (Sul):    ${minLat.toFixed(8)}°\n`;
    log += `  Latitude Máxima (Norte):  ${maxLat.toFixed(8)}°\n\n`;

    log += "Coordenadas Projetadas (UTM Metros):\n";
    log += `  X Mínimo (Easting):  ${minX.toFixed(4)} m\n`;
    log += `  X Máximo (Easting):  ${maxX.toFixed(4)} m\n`;
    log += `  Y Mínimo (Northing): ${minY.toFixed(4)} m\n`;
    log += `  Y Máximo (Northing): ${maxY.toFixed(4)} m\n\n`;

    log += "--------------------------------------------------------\n";
    log += `ERROS E ALERTAS ENCONTRADOS (${errors.length})\n`;
    log += "--------------------------------------------------------\n";
    if (errors.length === 0) {
        log += "Nenhum erro ou alerta encontrado. Processamento concluído com sucesso.\n";
    } else {
        errors.forEach((err, idx) => {
            log += `${idx + 1}. ${err}\n`;
        });
    }

    fs.writeFileSync(outputPath, log, "utf-8");
}
export default exportLog;
