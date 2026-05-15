import PDFDocument from "pdfkit";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { profile, conversation, foreword, tier } = req.body;

    if (!profile || !conversation) {
      return res.status(400).json({ error: "Missing profile or conversation" });
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: [432, 648], // 6x9 inches - standard memoir size
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info: {
        Title: `Minneboken til ${profile.name}`,
        Author: "Minnio",
        Subject: "En personlig minnebok",
        Creator: "Minnio.app"
      }
    });

    // Collect PDF data
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="minnio-${profile.name.toLowerCase()}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    });

    // Colors
    const GOLD = "#C8933A";
    const DARK = "#2D1C0C";
    const TEXT = "#3D2817";
    const MUTED = "#8B6F47";
    const CREAM = "#FAF3E8";

    // === COVER PAGE ===
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(CREAM);

    // Decorative star
    doc.fontSize(32).fillColor(GOLD).text("\u2726", 0, 180, {
      width: doc.page.width,
      align: "center"
    });

    // Title
    doc.fontSize(28)
       .fillColor(DARK)
       .font("Times-Italic")
       .text("Et liv fortalt", 0, 240, {
         width: doc.page.width,
         align: "center"
       });

    // Decorative line
    doc.moveTo(doc.page.width / 2 - 25, 295)
       .lineTo(doc.page.width / 2 + 25, 295)
       .strokeColor(GOLD)
       .lineWidth(0.5)
       .stroke();

    // Name
    doc.fontSize(14)
       .fillColor(MUTED)
       .font("Times-Roman")
       .text(profile.name.toUpperCase(), 0, 320, {
         width: doc.page.width,
         align: "center",
         characterSpacing: 4
       });

    // Subtitle
    doc.fontSize(11)
       .fillColor(MUTED)
       .font("Times-Italic")
       .text(profile.place || "", 0, 350, {
         width: doc.page.width,
         align: "center"
       });

    // Bottom branding
    doc.fontSize(9)
       .fillColor(MUTED)
       .font("Times-Roman")
       .text("MINNIO", 0, doc.page.height - 100, {
         width: doc.page.width,
         align: "center",
         characterSpacing: 6
       });

    // === FOREWORD PAGE ===
    doc.addPage();

    doc.fontSize(11)
       .fillColor(MUTED)
       .font("Times-Italic")
       .text("Forord", 72, 100);

    doc.moveTo(72, 125)
       .lineTo(122, 125)
       .strokeColor(GOLD)
       .stroke();

    if (foreword) {
      doc.fontSize(12)
         .fillColor(TEXT)
         .font("Times-Roman")
         .text(foreword, 72, 160, {
           width: doc.page.width - 144,
           align: "left",
           lineGap: 6
         });
    } else {
      doc.fontSize(12)
         .fillColor(TEXT)
         .font("Times-Italic")
         .text(
           `Denne boken er en samling av historiene til ${profile.name}. Hvert spørsmål og svar er fra en samtale ${profile.name} hadde med Minna, vår digitale assistent. Ordene er deres egne, fortalt til familien, slik at minnene aldri skal gå tapt.`,
           72, 160,
           {
             width: doc.page.width - 144,
             align: "left",
             lineGap: 6
           }
         );
    }

    // === CHAPTERS - Group conversation by life phases ===
    const chapters = organizeIntoChapters(conversation);

    chapters.forEach((chapter, idx) => {
      doc.addPage();

      // Chapter number
      doc.fontSize(10)
         .fillColor(MUTED)
         .font("Times-Italic")
         .text(`Kapittel ${idx + 1}`, 72, 100, { characterSpacing: 2 });

      // Chapter title
      doc.fontSize(22)
         .fillColor(DARK)
         .font("Times-Italic")
         .text(chapter.title, 72, 125, {
           width: doc.page.width - 144
         });

      // Decorative line
      doc.moveTo(72, 175)
         .lineTo(110, 175)
         .strokeColor(GOLD)
         .lineWidth(0.5)
         .stroke();

      let y = 200;

      chapter.exchanges.forEach((exchange) => {
        // Check if we need a new page
        if (y > doc.page.height - 150) {
          doc.addPage();
          y = 100;
        }

        // Question
        doc.fontSize(11)
           .fillColor(MUTED)
           .font("Times-Italic")
           .text(exchange.question, 72, y, {
             width: doc.page.width - 144,
             lineGap: 4
           });

        y = doc.y + 12;

        // Answer
        doc.fontSize(12)
           .fillColor(TEXT)
           .font("Times-Roman")
           .text(`"${exchange.answer}"`, 90, y, {
             width: doc.page.width - 162,
             lineGap: 5
           });

        y = doc.y + 24;

        // Subtle separator
        if (y < doc.page.height - 100) {
          doc.moveTo(doc.page.width / 2 - 15, y - 6)
             .lineTo(doc.page.width / 2 + 15, y - 6)
             .strokeColor(GOLD)
             .lineWidth(0.3)
             .stroke();
          y += 12;
        }
      });
    });

    // === ENDING PAGE ===
    doc.addPage();

    doc.fontSize(24)
       .fillColor(GOLD)
       .text("\u2726", 0, doc.page.height / 2 - 60, {
         width: doc.page.width,
         align: "center"
       });

    doc.fontSize(13)
       .fillColor(MUTED)
       .font("Times-Italic")
       .text(
         `Disse historiene er ${profile.name}s,\nfortalt med egne ord.\n\nLaget med varme av Minnio.`,
         72, doc.page.height / 2 - 10,
         {
           width: doc.page.width - 144,
           align: "center",
           lineGap: 8
         }
       );

    doc.fontSize(8)
       .fillColor(MUTED)
       .text("minnio.app", 0, doc.page.height - 80, {
         width: doc.page.width,
         align: "center",
         characterSpacing: 3
       });

    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 1; i < pages.count - 1; i++) {
      doc.switchToPage(i);
      doc.fontSize(9)
         .fillColor(MUTED)
         .font("Times-Roman")
         .text(`${i}`, 0, doc.page.height - 50, {
           width: doc.page.width,
           align: "center"
         });
    }

    doc.end();

  } catch (err) {
    console.error("PDF error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Organize conversation into chronological life chapters
function organizeIntoChapters(conversation) {
  // Build Q&A pairs from conversation
  const exchanges = [];
  let currentQ = null;

  conversation.forEach(msg => {
    if (msg.role === "assistant") {
      currentQ = msg.content.replace("[SAMTALE_FERDIG]", "").trim();
    } else if (msg.role === "user" && currentQ) {
      exchanges.push({ question: currentQ, answer: msg.content });
      currentQ = null;
    }
  });

  // Group into life phases based on Minna's structure
  const chapters = [
    { title: "Barndommen", exchanges: [] },
    { title: "Familien", exchanges: [] },
    { title: "Ungdomstiden", exchanges: [] },
    { title: "Kjærligheten", exchanges: [] },
    { title: "Arbeidslivet", exchanges: [] },
    { title: "Det som var vanskelig", exchanges: [] },
    { title: "Barnebarna", exchanges: [] },
    { title: "Takknemlighet", exchanges: [] }
  ];

  // Simple distribution: split exchanges into chapters
  const perChapter = Math.max(1, Math.ceil(exchanges.length / chapters.length));
  exchanges.forEach((ex, i) => {
    const chapterIdx = Math.min(Math.floor(i / perChapter), chapters.length - 1);
    chapters[chapterIdx].exchanges.push(ex);
  });

  // Return only chapters with content
  return chapters.filter(ch => ch.exchanges.length > 0);
}
