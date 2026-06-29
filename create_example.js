import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

async function createPdf() {
    try {
        const pdfDoc = await PDFDocument.create();
        const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

        const page = pdfDoc.addPage([600, 800]);
        const { width, height } = page.getSize();

        const drawText = (text, x, y, size = 12, font = timesFont) => {
            page.drawText(text, {
                x,
                y: height - y,
                size,
                font,
                color: rgb(0, 0, 0),
            });
        };

        drawText("MEMORIAL DESCRITIVO DE EXEMPLO - SIGEF", 50, 50, 16, timesBoldFont);
        drawText("Imóvel: Fazenda Modelo Exemplo", 50, 80, 12, timesFont);
        drawText("Proprietário: Diego Oris", 50, 100, 12, timesFont);
        drawText("Município: Coari | UF: AM", 50, 120, 12, timesFont);
        drawText("Fuso UTM: 20S | Datum: SIRGAS2000", 50, 140, 12, timesFont);

        drawText("TABELA DE COORDENADAS DOS VÉRTICES (Padrão SIGEF/INCRA):", 50, 180, 12, timesBoldFont);

        drawText("Vértice         Latitude                     Longitude", 50, 210, 11, courierFont);
        drawText("------------------------------------------------------------------------", 50, 225, 11, courierFont);
        drawText("P-0001          -04° 44' 00.00\"             -61° 22' 00.00\"", 50, 240, 11, courierFont);
        drawText("P-0002          -04° 44' 00.00\"             -61° 21' 00.00\"", 50, 255, 11, courierFont);
        drawText("P-0003          -04° 45' 00.00\"             -61° 21' 00.00\"", 50, 270, 11, courierFont);
        drawText("P-0004          -04° 45' 00.00\"             -61° 22' 00.00\"", 50, 285, 11, courierFont);
        drawText("P-0001          -04° 44' 00.00\"             -61° 22' 00.00\"", 50, 300, 11, courierFont);
        drawText("------------------------------------------------------------------------", 50, 315, 11, courierFont);

        drawText("Este é um documento de exemplo público livre de dados confidenciais.", 50, 350, 11, timesFont);

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync("exemplo_sigef.pdf", pdfBytes);
        console.log("PDF de exemplo criado com sucesso em exemplo_sigef.pdf!");
    } catch (err) {
        console.error("Erro ao criar PDF:", err);
    }
}

createPdf();
