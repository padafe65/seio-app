import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).toString();

const pdfItemsToLines = (items) => {
  const sorted = items.filter((item) => item.str?.trim()).sort((a, b) => {
    const yDifference = b.transform[5] - a.transform[5];
    return Math.abs(yDifference) > 2 ? yDifference : a.transform[4] - b.transform[4];
  });
  const lines = [];
  for (const item of sorted) {
    const y = item.transform[5];
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: item.transform[4], text: item.str.trim() });
  }
  return lines.sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const parsePdfQuestionLines = (pages) => {
  const items = [];
  let current = null;
  let activeOption = 0;
  for (const { page, lines } of pages) {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const questionMatch = line.match(/^(?:pregunta\s*)?(\d{1,3})\s*[.)\-:]\s*(\S.*)$/i);
      const optionMatch = line.match(/^\(?([A-D])\)?\s*[.)\-:]\s*(.*)$/i);
      if (questionMatch) {
        current = {
          position: items.length + 1,
          source_question_number: questionMatch[1],
          source_location: `Página ${page}`,
          question_text: questionMatch[2],
          option1: '', option2: '', option3: '', option4: '',
          correct_answer: '',
          image_references: JSON.stringify([{ page, note: 'Revisar y asociar las figuras del PDF original.' }]),
          rights_notes: 'Pendiente verificar autoría/licencia y contenido reconocido por OCR.'
        };
        items.push(current);
        activeOption = 0;
      } else if (current && optionMatch) {
        activeOption = optionMatch[1].toUpperCase().charCodeAt(0) - 64;
        current[`option${activeOption}`] = optionMatch[2].trim();
      } else if (current && line) {
        if (activeOption) {
          const key = `option${activeOption}`;
          current[key] = `${current[key]} ${line}`.trim();
        } else {
          current.question_text = `${current.question_text} ${line}`.trim();
        }
      }
    }
  }
  return items;
};

export const extractQuestionsFromPdf = async (file, onProgress = () => {}) => {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdf.numPages > 500) throw new Error('El archivo supera el límite de 500 páginas para esta importación.');
  const pages = [];
  const scannedPages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = pdfItemsToLines(content.items);
    if (lines.join(' ').trim().length >= 50) pages.push({ page: pageNumber, lines });
    else scannedPages.push({ page, pageNumber });
    onProgress({ page: pageNumber, total: pdf.numPages, stage: 'Leyendo texto del PDF' });
  }

  if (scannedPages.length) {
    const worker = await createWorker('spa');
    try {
      for (const { page, pageNumber } of scannedPages) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const result = await worker.recognize(canvas);
        pages.push({ page: pageNumber, lines: result.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) });
        onProgress({ page: pageNumber, total: pdf.numPages, stage: 'Aplicando OCR en español' });
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      await worker.terminate();
    }
  }

  pages.sort((a, b) => a.page - b.page);
  const items = parsePdfQuestionLines(pages);
  if (!items.length) throw new Error('No se reconocieron preguntas numeradas en el PDF.');
  return {
    detected_questions: items.length,
    pages: pdf.numPages,
    ocr_pages: scannedPages.length,
    incomplete_choices: items.filter((item) => [item.option1, item.option2, item.option3, item.option4].some((choice) => !choice)).length,
    items
  };
};
