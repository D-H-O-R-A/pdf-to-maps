/**
 * 🗺️ D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)
 * 
 * Coordenador Principal do Pipeline de Geoprocessamento.
 * Realiza a orquestração offline e determinística de leitura de PDFs,
 * extração de vértices, projeções cartográficas e renderizações de mapas.
 * 
 * @author Diego Oris
 * @license MIT
 * @copyright Copyright (c) 2026 Diego Oris. Todos os direitos reservados.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

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

// Estilizações de terminal com cores ANSI para logs profissionais
const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
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
 * Processa um único memorial descritivo PDF individualmente.
 * 
 * @param {string} pdfPath Caminho absoluto/relativo para o arquivo PDF
 * @param {string} outputRootDir Pasta raiz onde os resultados serão salvos
 */
async function processPDF(pdfPath, outputRootDir) {
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
            console.log(`     ${COLORS.green}➔${COLORS.reset} Mapa 2D de Alta Resolução [OK]`);
        } catch (err) {
            errors.push(`Falha na renderização 2D PNG: ${err.message}`);
            console.log(`     ${COLORS.red}✗${COLORS.reset} Mapa 2D de Alta Resolução [ERRO]`);
        }

        // 6.2. Renderização do Mapa 3D Isométrico com sombreamento solar (PNG)
        try {
            renderPNGMap3D(projectedVertices, path.join(outputDir, "mapa_3d.png"));
            console.log(`     ${COLORS.green}➔${COLORS.reset} Mapa 3D Isométrico Realista [OK]`);
        } catch (err) {
            errors.push(`Falha na renderização 3D PNG: ${err.message}`);
            console.log(`     ${COLORS.red}✗${COLORS.reset} Mapa 3D Isométrico Realista [ERRO]`);
        }

        // 6.3. Exportação vetorial em formato escalável (SVG)
        try {
            exportSVG(projectedVertices, path.join(outputDir, "mapa.svg"));
            console.log(`     ${COLORS.green}➔${COLORS.reset} Vetor Escalável SVG [OK]`);
        } catch (err) {
            errors.push(`Falha na exportação SVG: ${err.message}`);
            console.log(`     ${COLORS.red}✗${COLORS.reset} Vetor Escalável SVG [ERRO]`);
        }

        // 6.4. Exportação GIS padrão OGC (GeoJSON)
        try {
            exportGeoJSON(projectedVertices, path.join(outputDir, "mapa.geojson"), pdfBaseName);
            console.log(`     ${COLORS.green}➔${COLORS.reset} Vetor Geográfico GeoJSON [OK]`);
        } catch (err) {
            errors.push(`Falha na exportação GeoJSON: ${err.message}`);
            console.log(`     ${COLORS.red}✗${COLORS.reset} Vetor Geográfico GeoJSON [ERRO]`);
        }

        // 6.5. Exportação CAD profissional em escala real (DXF)
        try {
            exportDXF(projectedVertices, path.join(outputDir, "mapa.dxf"));
            console.log(`     ${COLORS.green}➔${COLORS.reset} Desenho Técnico AutoCAD DXF [OK]`);
        } catch (err) {
            errors.push(`Falha na exportação CAD DXF: ${err.message}`);
            console.log(`     ${COLORS.red}✗${COLORS.reset} Desenho Técnico AutoCAD DXF [ERRO]`);
        }

        // 6.6. Criação do log topográfico detalhado com cálculos de área e perímetro
        const duration = performance.now() - startTime;
        exportLog(projectedVertices, zone, isSouth, duration, errors, path.join(outputDir, "log.txt"));
        console.log(`     ${COLORS.green}➔${COLORS.reset} Relatório de Medições Topográficas [OK]`);

        // Conclusão com sucesso
        const statusIcon = errors.length > 0 ? `${COLORS.yellow}⚠ [CONCLUÍDO COM AVISOS]` : `${COLORS.green}✔ [SUCESSO]`;
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

/**
 * Resolve e valida o diretório que contém os arquivos PDF de entrada.
 * 
 * @returns {string} Caminho resolvido da pasta de mapas contendo PDFs
 */
function resolvePDFDirectory() {
    let mapsDir = process.argv[2];

    if (mapsDir) {
        return mapsDir;
    }

    // Descoberta dinâmica de caminhos de arquivos locais de conveniência
    const hasLocalPDFs = fs.readdirSync(".")
        .some(f => path.extname(f).toLowerCase() === ".pdf");

    if (hasLocalPDFs) {
        return ".";
    }

    if (fs.existsSync("./maps")) {
        return "./maps";
    }

    // Se estiver rodando do diretório raiz ou de subpastas profundas
    if (fs.existsSync("../../../maps")) {
        return "../../../maps";
    }
    if (fs.existsSync("../../maps")) {
        return "../../maps";
    }

    // Busca baseada no root da aplicação de forma estrita
    const __filename = fileURLToPath(import.meta.url);
    const packageRoot = path.resolve(path.dirname(__filename), "..");
    const rootHasPDFs = fs.existsSync(packageRoot) && fs.readdirSync(packageRoot)
        .some(f => path.extname(f).toLowerCase() === ".pdf");

    if (rootHasPDFs) {
        return packageRoot;
    }

    console.error(`\n${COLORS.red}${COLORS.bright}[ERRO]${COLORS.reset} Pasta com arquivos PDF não foi localizada!`);
    console.log(`Por favor, indique o diretório no comando de execução:`);
    console.log(`  node index.js [caminho_da_pasta_com_pdfs]\n`);
    process.exit(1);
}

/**
 * Função principal coordenadora da aplicação.
 */
async function main() {
    const pipelineStartTime = performance.now();

    // 1. Apresentação inicial do sistema (Branding livre de IA/Planetone, focado em Diego Oris)
    console.log(`\n${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(`${COLORS.bright}🗺️  D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(` Autor:  ${COLORS.bright}Diego Oris${COLORS.reset}`);
    console.log(` Licença: MIT (Open-Source)`);
    console.log(` Repositório: https://github.com/D-H-O-R-A/pdf-to-maps`);
    console.log(`${COLORS.magenta}------------------------------------------------------------------------${COLORS.reset}`);

    // 2. Resolução do diretório e verificação de arquivos
    const mapsDir = resolvePDFDirectory();
    const outputDir = "./output";

    console.log(` Pasta de Entrada: ${COLORS.cyan}${path.resolve(mapsDir)}${COLORS.reset}`);
    console.log(` Pasta de Saída:   ${COLORS.cyan}${path.resolve(outputDir)}${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}`);

    if (!fs.existsSync(mapsDir)) {
        console.error(`${COLORS.red}[ERRO]${COLORS.reset} O diretório de entrada não existe: ${mapsDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(mapsDir);
    const pdfFiles = files
        .filter(f => path.extname(f).toLowerCase() === ".pdf")
        .map(f => path.join(mapsDir, f));

    if (pdfFiles.length === 0) {
        console.log(`${COLORS.yellow}Nenhum arquivo de memorial .pdf encontrado para processar.${COLORS.reset}`);
        process.exit(0);
    }

    console.log(`Fila de processamento criada: ${COLORS.bright}${pdfFiles.length}${COLORS.reset} arquivos localizados.\n`);

    // Garantia de pasta de saída
    ensureDirExists(outputDir);

    // 3. Orquestração paralela de alta performance com limite seguro de concorrência
    // Renderizações com o node-canvas usam CPU de forma paralela intensa.
    // Usamos fatiamento por lote de concorrência 4 para equilibrar uso de memória e velocidade.
    const CONCURRENCY_LIMIT = 4;
    for (let i = 0; i < pdfFiles.length; i += CONCURRENCY_LIMIT) {
        const batch = pdfFiles.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(pdfPath => processPDF(pdfPath, outputDir)));
    }

    // 4. Fechamento e dashboard consolidado de finalização
    const totalTimeSeconds = (performance.now() - pipelineStartTime) / 1000;
    console.log(`\n${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}🏁 PIPELINE DE GEOPROCESSAMENTO CONCLUÍDO COM SUCESSO!${COLORS.reset}`);
    console.log(`${COLORS.magenta}------------------------------------------------------------------------${COLORS.reset}`);
    console.log(` Total de Documentos: ${COLORS.bright}${pdfFiles.length}${COLORS.reset}`);
    console.log(` Tempo Total Decorrido: ${COLORS.bright}${totalTimeSeconds.toFixed(2)} segundos${COLORS.reset}`);
    console.log(` Saídas Geradas em:   ${COLORS.cyan}${path.resolve(outputDir)}${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}\n`);
}

main().catch(err => {
    console.error(`\n${COLORS.red}❌ [ERRO CRÍTICO] Falha catastrófica no loop principal: ${err.message}${COLORS.reset}\n`);
    process.exit(1);
});
