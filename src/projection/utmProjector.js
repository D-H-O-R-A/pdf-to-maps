import proj4 from "proj4";

/**
 * Dynamically computes the UTM zone and hemisphere from a longitude and latitude.
 * 
 * @param {number} lon Longitude in decimal degrees
 * @param {number} lat Latitude in decimal degrees
 * @returns {{zone: number, isSouth: boolean, projStr: string}} UTM parameters and proj4 definition
 */
export function getUTMParameters(lon, lat) {
    // UTM zones are 1 to 60, each 6 degrees wide, starting at -180 degrees
    const zone = Math.floor((lon + 180) / 6) + 1;
    const isSouth = lat < 0;

    // SIRGAS2000 UTM Proj4 definition (Ellipsoid GRS80)
    const projStr = `+proj=utm +zone=${zone} ${isSouth ? '+south ' : ''}+ellps=GRS80 +units=m +no_defs`;
    return { zone, isSouth, projStr };
}

/**
 * Projects a list of vertices with longitude/latitude to SIRGAS2000 UTM (meters).
 * 
 * @param {{code: string, lon: number, lat: number}[]} vertices List of geographic vertices
 * @returns {{projectedVertices: any[], zone: number, isSouth: boolean}} Projected vertices and UTM details
 */
export function projectVerticesToUTM(vertices) {
    if (!vertices || vertices.length === 0) {
        return { projectedVertices: [], zone: 0, isSouth: true };
    }

    // Use the first vertex to detect the UTM zone and hemisphere
    // This is mathematically sound as SIGEF properties are local and lie in a single UTM zone
    const firstVertex = vertices[0];
    const { zone, isSouth, projStr } = getUTMParameters(firstVertex.lon, firstVertex.lat);

    // Source coordinate system: geographic WGS84 / SIRGAS2000
    const sourceProj = "+proj=longlat +ellps=GRS80 +no_defs";

    const projectedVertices = vertices.map(v => {
        // proj4 expects coordinates in [longitude, latitude] order
        const [utmX, utmY] = proj4(sourceProj, projStr, [v.lon, v.lat]);
        return {
            ...v,
            utmX,
            utmY
        };
    });

    return {
        projectedVertices,
        zone,
        isSouth
    };
}
