import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import fs from "fs";
import path from "path";

function formatDate(value: Date | string | null | undefined): string {
    if (!value) return "Not scheduled";
    return new Date(value).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    }) + " (UTC)";
}

function truncateText(value: unknown, limit = 240): string {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function getLogoSvg(): string | null {
    const logoPath = path.resolve(__dirname, "../../..", "frontend", "public", "logo.svg");
    try {
        return fs.readFileSync(logoPath, "utf8");
    } catch {
        return null;
    }
}

export function generateReportPdf(params: {
    title: string;
    subtitle: string;
    generatedAt: Date;
    accent: string;
    kpis?: Array<{ label: string; value: string; note?: string }>;
    sections: Array<{ title: string; rows: Array<Array<unknown>> }>;
}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 34, bufferPages: true, autoFirstPage: true });
        const chunks: Buffer[] = [];
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 34;
        const contentWidth = pageWidth - margin * 2;
        const logoSvg = getLogoSvg();
        const colors = {
            ink: "#0F172A",
            muted: "#64748B",
            line: "#E2E8F0",
            subtleLine: "#F1F5F9",
            accent: params.accent,
            softAccent: params.accent === "#7C3AED" ? "#F5F3FF" : "#EFF6FF",
            table: "#F8FAFC",
            white: "#FFFFFF",
        };

        doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const hasSpace = (height: number) => doc.y + height <= doc.page.height - margin - 16;
        const addReportPage = () => {
            doc.addPage();
            drawPageHeader(false);
        };
        const ensureSpace = (height: number) => {
            if (!hasSpace(height)) {
                addReportPage();
            }
        };

        const drawLogo = (x: number, y: number, size: number) => {
            if (logoSvg) {
                try {
                    SVGtoPDF(doc, logoSvg, x, y, {
                        width: size,
                        height: size,
                        preserveAspectRatio: "xMidYMid meet",
                    });
                    return;
                } catch {
                    // Fall through
                }
            }
            doc.roundedRect(x, y, size, size, 8).fill(colors.softAccent).strokeColor(colors.line).stroke();
            doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(13).text("CW", x + 6, y + size / 2 - 7, {
                width: size - 12,
                align: "center",
                lineBreak: false,
            });
        };

        const drawPageHeader = (hero: boolean) => {
            if (hero) {
                doc.rect(margin, margin, contentWidth, 1).fill(colors.ink);
                drawLogo(margin, margin + 22, 34);
                doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(9).text("CLOUDWATCHER", margin + 44, margin + 24, {
                    width: 180,
                    characterSpacing: 0.9,
                    lineBreak: false,
                });
                doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(7).text("RABBITT AI REPORTING", margin + 44, margin + 38, {
                    width: 180,
                    characterSpacing: 1.2,
                    lineBreak: false,
                });
                doc.roundedRect(pageWidth - margin - 176, margin + 22, 176, 34, 6).fill(colors.table).strokeColor(colors.line).stroke();
                doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(6.5).text("GENERATED", pageWidth - margin - 162, margin + 29, {
                    width: 52,
                    lineBreak: false,
                });
                doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(7.5).text(formatDate(params.generatedAt), pageWidth - margin - 106, margin + 28, {
                    width: 92,
                    height: 10,
                    align: "right",
                    lineBreak: false,
                });
                doc.fillColor(colors.muted).font("Helvetica").fontSize(7).text("Scheduled email attachment", pageWidth - margin - 162, margin + 42, {
                    width: 148,
                    align: "right",
                    lineBreak: false,
                });
                doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(25).text(params.title, margin, margin + 82, {
                    width: contentWidth,
                    height: 30,
                    lineBreak: false,
                });
                doc.fillColor(colors.muted).font("Helvetica").fontSize(10).text(params.subtitle, margin, margin + 112, {
                    width: contentWidth - 160,
                    height: 14,
                    lineBreak: false,
                });
                doc.roundedRect(pageWidth - margin - 128, margin + 105, 128, 22, 5).fill(colors.softAccent).strokeColor(colors.line).stroke();
                doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(8).text(`${params.sections.length} included sections`, pageWidth - margin - 116, margin + 112, {
                    width: 104,
                    align: "right",
                    lineBreak: false,
                });
                doc.y = margin + 138;
                return;
            }

            drawLogo(margin, 22, 24);
            doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(8).text("CLOUDWATCHER", margin + 32, 25, {
                width: 160,
                characterSpacing: 1,
                lineBreak: false,
            });
            doc.fillColor(colors.muted).font("Helvetica").fontSize(8).text(params.title, margin + 32, 38, {
                width: 260,
                lineBreak: false,
            });
            doc.moveTo(margin, 58).lineTo(pageWidth - margin, 58).strokeColor(colors.line).lineWidth(1).stroke();
            doc.y = 74;
        };

        const drawKpis = () => {
            const cards = (params.kpis?.length ? params.kpis : [
                { label: "Generated", value: formatDate(params.generatedAt) },
                { label: "Sections", value: String(params.sections.length) },
                { label: "Format", value: "PDF report" },
            ]).slice(0, 3);
            const gap = 10;
            const cardWidth = (contentWidth - gap * 2) / 3;
            const top = doc.y;
            cards.forEach((card, index) => {
                const x = margin + index * (cardWidth + gap);
                doc.roundedRect(x, top, cardWidth, 62, 6).fill(colors.white).strokeColor(colors.line).stroke();
                doc.rect(x, top, cardWidth, 3).fill(index === 0 ? colors.accent : colors.subtleLine);
                doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(7).text(card.label.toUpperCase(), x + 12, top + 12, {
                    width: cardWidth - 24,
                    characterSpacing: 0.5,
                    lineBreak: false,
                });
                doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(17).text(card.value, x + 12, top + 27, {
                    width: cardWidth - 24,
                    height: 20,
                    lineBreak: false,
                });
                if (card.note) {
                    doc.fillColor(colors.muted).font("Helvetica").fontSize(7.5).text(card.note, x + 12, top + 48, {
                        width: cardWidth - 24,
                        height: 10,
                        lineBreak: false,
                    });
                }
            });
            doc.y = top + 82;
        };

        const drawSection = (section: { title: string; rows: Array<Array<unknown>> }) => {
            ensureSpace(116);
            const sectionTop = doc.y;
            doc.fillColor(colors.accent).rect(margin, sectionTop + 2, 3, 13).fill();
            doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(12.5).text(section.title, margin + 12, sectionTop, {
                width: contentWidth - 12,
                height: 18,
                lineBreak: false,
            });
            doc.y = sectionTop + 24;
            const colA = 145;
            const colB = 100;
            const colC = contentWidth - colA - colB;
            const drawTableHeader = () => {
                const tableTop = doc.y;
                doc.rect(margin, tableTop, contentWidth, 22).fill(colors.table).strokeColor(colors.line).stroke();
                doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(8);
                doc.text("ITEM", margin + 10, tableTop + 7, { width: colA - 18, lineBreak: false });
                doc.text("VALUE", margin + colA + 8, tableTop + 7, { width: colB - 16, lineBreak: false });
                doc.text("DETAIL", margin + colA + colB + 8, tableTop + 7, { width: colC - 18, lineBreak: false });
                doc.y = tableTop + 22;
            };

            drawTableHeader();

            section.rows.forEach((row) => {
                const [first, second, third] = row;
                const detail = third === undefined ? second : third;
                const value = third === undefined ? "" : second;
                const item = truncateText(first, 80) || "Item";
                const valueText = truncateText(value, 42);
                const detailText = truncateText(detail, 260);
                const rowHeight = Math.max(
                    34,
                    Math.min(76, doc.heightOfString(detailText, { width: colC - 18, lineGap: 1 }) + 16),
                    Math.min(76, doc.heightOfString(item, { width: colA - 18 }) + 16)
                );
                if (!hasSpace(rowHeight + 8)) {
                    addReportPage();
                    drawTableHeader();
                }
                const y = doc.y;
                doc.rect(margin, y, contentWidth, rowHeight).fill(colors.white);
                doc.moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).strokeColor(colors.subtleLine).lineWidth(1).stroke();
                doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(8.5).text(item, margin + 10, y + 9, { width: colA - 18, height: rowHeight - 14 });
                doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(8.5).text(valueText, margin + colA + 8, y + 9, { width: colB - 16, height: rowHeight - 14 });
                doc.fillColor("#334155").font("Helvetica").fontSize(8.5).text(detailText, margin + colA + colB + 8, y + 9, { width: colC - 18, height: rowHeight - 14, lineGap: 1 });
                doc.y = y + rowHeight;
            });
            doc.moveDown(1);
        };

        drawPageHeader(true);
        drawKpis();
        params.sections.forEach(drawSection);

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const footerY = pageHeight - margin - 12;
            doc.moveTo(margin, footerY - 8).lineTo(pageWidth - margin, footerY - 8).strokeColor(colors.line).lineWidth(0.5).stroke();
            doc.fillColor(colors.muted).font("Helvetica").fontSize(8).text(
                `CloudWatcher by Rabbitt AI  |  Page ${i + 1} of ${range.count}`,
                margin,
                footerY,
                { width: contentWidth, height: 10, align: "center", lineBreak: false }
            );
        }

        doc.end();
    });
}
