/**
 * 🗺️ D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)
 * 
 * Ponto de Entrada da API Programática da Biblioteca (NPM Library Export).
 * Permite que outros desenvolvedores importem e usem os parsers, projetores,
 * renderizadores e exportadores individualmente em suas próprias aplicações.
 * 
 * @author Diego Oris
 * @license MIT
 * @copyright Copyright (c) 2026 Diego Oris. Todos os direitos reservados.
 */

import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";

// Importações dos submódulos do geoprocessador
import { readPDFAndReconstructLines } from "./parser/pdfReader.js";
import { extractVerticesFromReconstructedLines } from "./parser/vertexExtractor.js";
import { projectVerticesToUTM } from "./projection/utmProjector.js";
import { renderPNGMap } from "./draw/mapRenderer.js";
import { renderPNGMap3D } from "./draw/mapRenderer3D.js";
import { exportGeoJSON } from "./export/geojsonExporter.js";
import { exportSVG } from "./export/svgExporter.js";
import { exportDXF } from "./export/dxfExporter.js";
import { exportLog } from "./export/logExporter.js";
import { ensureDirExists, getFileBaseName } from "./utils/helper.js";

// Re-exportação explícita de todas as ferramentas para desenvolvedores externos
export {
    readPDFAndReconstructLines,
    extractVerticesFromReconstructedLines,
    projectVerticesToUTM,
    renderPNGMap,
    renderPNGMap3D,
    exportGeoJSON,
    exportSVG,
    exportDXF,
    exportLog,
    ensureDirExists,
    getFileBaseName
};

// Estilizações de terminal com cores ANSI para logs
const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m"
};

/**
 * Valida os vértices extraídos do documento e fecha o polígono se necessário.
 * 
 * @param {Array<object>} vertices Lista de vértices brutos extraídos do PDF
 * @returns {Array<object>} Lista de vértices higienizados, validados e fechados
 * @throws {Error} Se houver número insuficiente de vértices para formar área
 */
export function validateAndClosePolygon(vertices) {
    // 1. Limpeza: remove vértices inválidos, nulos ou sem coordenadas válidas
    const clean = vertices.filter(v => 
        v && 
        v.code && 
        typeof v.lon === "number" && !isNaN(v.lon) &&
        typeof v.lat === "number" && !isNaN(v.lat)
    );

    // 2. Eliminação de duplicatas sequenciais exatas (ex: mesmo vértice repetido consecutivamente)
    const unique = [];
    for (const curr of clean) {
        if (unique.length === 0) {
            unique.push(curr);
        } else {
            const last = unique[unique.length - 1];
            const isDuplicate = last.code === curr.code || 
                (Math.abs(last.lon - curr.lon) < 1e-7 && Math.abs(last.lat - curr.lat) < 1e-7);
            
            if (!isDuplicate) {
                unique.push(curr);
            }
        }
    }

    // 3. Verificação de limite mínimo para polígonos fechados (mínimo 3 vértices únicos)
    if (unique.length < 3) {
        throw new Error(`Quantidade insuficiente de vértices únicos (${unique.length}). Mínimo de 3 necessário.`);
    }

    // 4. Fechamento de polígono (o primeiro vértice deve coincidir com o último)
    const first = unique[0];
    const last = unique[unique.length - 1];
    const isClosed = first.code === last.code || 
        (Math.abs(first.lon - last.lon) < 1e-7 && Math.abs(first.lat - last.lat) < 1e-7);

    if (!isClosed) {
        unique.push({
            ...first,
            code: `${first.code}_FECHAMENTO` // Identificador do vértice de fechamento
        });
    }

    return unique;
}

/**
 * Processa um único memorial descritivo PDF individualmente de forma isolada.
 * Esta função pode ser importada programaticamente por outros sistemas Node.js.
 * 
 * @param {string} pdfPath Caminho absoluto/relativo para o arquivo PDF
 * @param {string} outputRootDir Pasta raiz onde os resultados serão salvos
 */
export async function processPDF(pdfPath, outputRootDir) {
    const startTime = performance.now();
    const pdfBaseName = getFileBaseName(pdfPath);
    const outputDir = path.join(outputRootDir, pdfBaseName);
    const errors = [];

    console.log(`\n${COLORS.cyan}${COLORS.bright}[INICIADO]${COLORS.reset} Processando memorial: ${COLORS.bright}${pdfBaseName}.pdf${COLORS.reset}`);

    try {
        ensureDirExists(outputDir);

        // Etapa 1: Leitura e reconstrução espacial das linhas de texto do PDF
        const lines = await readPDFAndReconstructLines(pdfPath);
        if (!lines || lines.length === 0) {
            throw new Error("Não foi possível ler ou reconstruir as linhas de texto do PDF.");
        }
        console.log(`   ${COLORS.green}✔${COLORS.reset} ${COLORS.gray}[Etapa 1/6]${COLORS.reset} Leitura espacial concluída.`);

        // Etapa 2: Extração regex de coordenadas estruturadas
        const rawVertices = extractVerticesFromReconstructedLines(lines);
        if (!rawVertices || rawVertices.length === 0) {
            throw new Error("Nenhum vértice padrão INCRA/SIGEF pôde ser extraído.");
        }
        console.log(`   ${COLORS.green}✔${COLORS.reset} ${COLORS.gray}[Etapa 2/6]${COLORS.reset} Vértices extraídos com sucesso (${rawVertices.length} encontrados).`);

        // Etapa 3: Validação topológica e fechamento do polígono geográfico
        const closedVertices = validateAndClosePolygon(rawVertices);
        console.log(`   ${COLORS.green}✔${COLORS.reset} ${COLORS.gray}[Etapa 3/6]${COLORS.reset} Malha fechada e validada (${closedVertices.length} vértices no polígono).`);

        // Etapa 4: Projeção geodésica para malha métrica plana (UTM SIRGAS2000)
        const { projectedVertices, zone, isSouth } = projectVerticesToUTM(closedVertices);
        if (!projectedVertices || projectedVertices.length === 0) {
            throw new Error("Falha de conversão no motor de projeção UTM (Proj4).");
        }
        console.log(`   ${COLORS.green}✔${COLORS.reset} ${COLORS.gray}[Etapa 4/6]${COLORS.reset} Projeção UTM concluída: Zona ${zone}${isSouth ? "S" : "N"}.`);

        // Etapa 5: Exportação dos dados estruturados em JSON
        fs.writeFileSync(
            path.join(outputDir, "vertices.json"),
            JSON.stringify(projectedVertices, null, 2),
            "utf-8"
        );
        console.log(`   ${COLORS.green}✔${COLORS.reset} ${COLORS.gray}[Etapa 5/6]${COLORS.reset} Coordenadas salvas em 'vertices.json'.`);

        // Etapa 6: Geração assíncrona tolerante a falhas dos mapas e formatos cartográficos
        console.log(`   ${COLORS.gray}[Etapa 6/6] Renderizando pacotes de saída...${COLORS.reset}`);

        // 6.1. Renderização do Mapa 2D de alta definição (PNG)
        try {
            renderPNGMap(projectedVertices, path.join(outputDir, "mapa.png"));
            console.log("     " + COLORS.green + "➔" + COLORS.reset + " Mapa 2D de Alta Resolução [OK]");
        } catch (err) {
            errors.push(`Falha na renderização 2D PNG: ${err.message}`);
            console.log("     " + COLORS.red + "✗" + COLORS.reset + " Mapa 2D de Alta Resolução [ERRO]");
        }

        // 6.2. Renderização do Mapa 3D Isométrico com sombreamento solar (PNG)
        try {
            renderPNGMap3D(projectedVertices, path.join(outputDir, "mapa_3d.png"));
            console.log("     " + COLORS.green + "➔" + COLORS.reset + " Mapa 3D Isométrico Realista [OK]");
        } catch (err) {
            errors.push(`Falha na renderização 3D PNG: ${err.message}`);
            console.log("     " + COLORS.red + "✗" + COLORS.reset + " Mapa 3D Isométrico Realista [ERRO]");
        }

        // 6.3. Exportação vetorial em formato escalável (SVG)
        try {
            exportSVG(projectedVertices, path.join(outputDir, "mapa.svg"));
            console.log("     " + COLORS.green + "➔" + COLORS.reset + " Vetor Escalável SVG [OK]");
        } catch (err) {
            errors.push(`Falha na exportação SVG: ${err.message}`);
            console.log("     " + COLORS.red + "✗" + COLORS.reset + " Vetor Escalável SVG [ERRO]");
        }

        // 6.4. Exportação GIS padrão OGC (GeoJSON)
        try {
            exportGeoJSON(projectedVertices, path.join(outputDir, "mapa.geojson"), pdfBaseName);
            console.log("     " + COLORS.green + "➔" + COLORS.reset + " Vetor Geográfico GeoJSON [OK]");
        } catch (err) {
            errors.push(`Falha na exportação GeoJSON: ${err.message}`);
            console.log("     " + COLORS.red + "✗" + COLORS.reset + " Vetor Geográfico GeoJSON [ERRO]");
        }

        // 6.5. Exportação CAD profissional em escala real (DXF)
        try {
            exportDXF(projectedVertices, path.join(outputDir, "mapa.dxf"));
            console.log("     " + COLORS.green + "➔" + COLORS.reset + " Desenho Técnico AutoCAD DXF [OK]");
        } catch (err) {
            errors.push(`Falha na exportação CAD DXF: ${err.message}`);
            console.log("     " + COLORS.red + "✗" + COLORS.reset + " Desenho Técnico AutoCAD DXF [ERRO]");
        }

        // 6.6. Criação do log topográfico detalhado com cálculos de área e perímetro
        const duration = performance.now() - startTime;
        exportLog(projectedVertices, zone, isSouth, duration, errors, path.join(outputDir, "log.txt"));
        console.log("     " + COLORS.green + "➔" + COLORS.reset + " Relatório de Medições Topográficas [OK]");

        // Conclusão com sucesso
        const statusIcon = errors.length > 0 ? COLORS.yellow + "⚠ [CONCLUÍDO COM AVISOS]" : COLORS.green + "✔ [SUCESSO]";
        console.log(`${statusIcon}${COLORS.reset} ${pdfBaseName} processado perfeitamente em ${COLORS.bright}${duration.toFixed(0)}ms${COLORS.reset}`);
        if (errors.length > 0) {
            console.log(`   ${COLORS.yellow}Nota: Alguns exportadores secundários geraram alertas:${COLORS.reset}`);
            errors.forEach(e => console.log(`     - ${e}`));
        }
    } catch (err) {
        const duration = performance.now() - startTime;
        console.error(`${COLORS.red}❌ [FALHA CRÍTICA]${COLORS.reset} Erro ao processar ${pdfBaseName}: ${err.message}`);
        
        // Geração de arquivo log.txt residual para auditoria de falhas
        errors.push(`FALHA CRÍTICA NO PROCESSAMENTO: ${err.message}`);
        try {
            ensureDirExists(outputDir);
            fs.writeFileSync(
                path.join(outputDir, "log.txt"),
                `========================================================\n` +
                `D-H-O-R-A/pdf-to-maps — PARSING ERROR LOG\n` +
                `========================================================\n\n` +
                `FALHA CRÍTICA NO PROCESSAMENTO DO ARQUIVO:\n` +
                `Mensagem: ${err.message}\n` +
                `Caminho: ${pdfPath}\n\n` +
                `Tempo de execução antes da falha: ${duration.toFixed(2)}ms\n`
            );
        } catch (writeErr) {
            // Ignorado silenciosamente
        }
    }
}
