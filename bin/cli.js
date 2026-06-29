#!/usr/bin/env node

/**
 * 🗺️ D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)
 * 
 * Executável da Linha de Comando (CLI) para o pacote npm.
 * Permite processar diretórios contendo arquivos PDF georreferenciados diretamente do terminal.
 * 
 * @author Diego Oris
 * @license MIT
 * @copyright Copyright (c) 2026 Diego Oris. Todos os direitos reservados.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

import { processPDF } from "../src/index.js";
import { ensureDirExists } from "../src/utils/helper.js";

// Estilizações de terminal com cores ANSI
const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m"
};

/**
 * Resolve e valida o diretório de entrada com arquivos PDF.
 */
function resolvePDFDirectory() {
    let mapsDir = process.argv[2];

    if (mapsDir) {
        return mapsDir;
    }

    // Busca de conveniência em diretórios locais padrão
    const hasLocalPDFs = fs.readdirSync(".")
        .some(f => path.extname(f).toLowerCase() === ".pdf");

    if (hasLocalPDFs) {
        return ".";
    }

    if (fs.existsSync("./maps")) {
        return "./maps";
    }

    // Busca baseada no root do próprio pacote executável
    const __filename = fileURLToPath(import.meta.url);
    const packageRoot = path.resolve(path.dirname(__filename), "..");
    const rootHasPDFs = fs.existsSync(packageRoot) && fs.readdirSync(packageRoot)
        .some(f => path.extname(f).toLowerCase() === ".pdf");

    if (rootHasPDFs) {
        return packageRoot;
    }

    console.error(`\n${COLORS.red}${COLORS.bright}[ERRO]${COLORS.reset} Pasta com arquivos PDF não foi localizada!`);
    console.log(`Por favor, indique o diretório no comando de execução:`);
    console.log(`  npx pdf-to-maps [caminho_da_pasta_com_pdfs]\n`);
    process.exit(1);
}

/**
 * Coordenador da execução CLI do pipeline.
 */
async function runCLI() {
    const pipelineStartTime = performance.now();

    // 1. Apresentação visual da CLI
    console.log(`\n${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(`${COLORS.bright}🗺️  D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(` Autor:  ${COLORS.bright}Diego Oris${COLORS.reset}`);
    console.log(` Licença: MIT (Open-Source)`);
    console.log(` Repositório: https://github.com/D-H-O-R-A/pdf-to-maps`);
    console.log(`${COLORS.magenta}------------------------------------------------------------------------${COLORS.reset}`);

    const mapsDir = resolvePDFDirectory();
    const outputDir = "./output";

    console.log(` Pasta de Entrada: ${COLORS.cyan}${path.resolve(mapsDir)}${COLORS.reset}`);
    console.log(` Pasta de Saída:   ${COLORS.cyan}${path.resolve(outputDir)}${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}`);

    if (!fs.existsSync(mapsDir)) {
        console.error(`${COLORS.red}[ERRO]${COLORS.reset} O diretório de entrada não existe: ${mapsDir}`);
        process.exit(1);
    }

    // 2. Escaneamento e filtro de PDFs
    const files = fs.readdirSync(mapsDir);
    const pdfFiles = files
        .filter(f => path.extname(f).toLowerCase() === ".pdf")
        .map(f => path.join(mapsDir, f));

    if (pdfFiles.length === 0) {
        console.log(`${COLORS.yellow}Nenhum arquivo de memorial .pdf encontrado para processar.${COLORS.reset}`);
        process.exit(0);
    }

    console.log(`Fila de processamento criada: ${COLORS.bright}${pdfFiles.length}${COLORS.reset} arquivos localizados.\n`);

    ensureDirExists(outputDir);

    // 3. Execução paralela com concorrência limite de 4 workers
    const CONCURRENCY_LIMIT = 4;
    for (let i = 0; i < pdfFiles.length; i += CONCURRENCY_LIMIT) {
        const batch = pdfFiles.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(pdfPath => processPDF(pdfPath, outputDir)));
    }

    // 4. Consolidação das saídas geradas
    const totalTimeSeconds = (performance.now() - pipelineStartTime) / 1000;
    console.log(`\n${COLORS.magenta}========================================================================${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}🏁 PIPELINE DE GEOPROCESSAMENTO CONCLUÍDO COM SUCESSO!${COLORS.reset}`);
    console.log(`${COLORS.magenta}------------------------------------------------------------------------${COLORS.reset}`);
    console.log(` Total de Documentos: ${COLORS.bright}${pdfFiles.length}${COLORS.reset}`);
    console.log(` Tempo Total Decorrido: ${COLORS.bright}${totalTimeSeconds.toFixed(2)} segundos${COLORS.reset}`);
    console.log(` Saídas Geradas em:   ${COLORS.cyan}${path.resolve(outputDir)}${COLORS.reset}`);
    console.log(`${COLORS.magenta}========================================================================${COLORS.reset}\n`);
}

runCLI().catch(err => {
    console.error(`\n${COLORS.red}❌ [ERRO CRÍTICO] Falha catastrófica no loop principal do CLI: ${err.message}${COLORS.reset}\n`);
    process.exit(1);
});
