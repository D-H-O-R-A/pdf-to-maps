import fs from "fs";

/**
 * Generates and saves a valid GeoJSON FeatureCollection containing a closed Polygon.
 * 
 * @param {any[]} vertices List of closed vertices (with lon, lat)
 * @param {string} outputPath Target path to save the .geojson file
 * @param {string} name Property name
 */
export function exportGeoJSON(vertices, outputPath, name = "Imóvel") {
    // Collect coordinates in [lon, lat] order
    const coordinates = vertices.map(v => [v.lon, v.lat]);

    // GeoJSON Polygon geometry coordinates must be an array of linear rings.
    // The first ring is the exterior boundary.
    const geojsonData = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    name,
                    verticesCount: vertices.length,
                    generator: "pdf-to-maps"
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [coordinates]
                }
            }
        ]
    };

    fs.writeFileSync(outputPath, JSON.stringify(geojsonData, null, 2), "utf-8");
}
export default exportGeoJSON;
