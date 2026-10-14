import { inflateRawSync } from 'node:zlib';
import path from 'node:path';

const xmlUnescape = (value = '') => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));

const getZipEntry = (buffer, wantedName) => {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no parece ser un DOCX válido.');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Estructura DOCX inválida.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Entrada DOCX inválida.');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      throw new Error('El DOCX usa un método de compresión no compatible.');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Falta ${wantedName} en el documento.`);
};

const getZipFileData = (buffer, wantedName) => {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo DOCX no contiene un ZIP válido.');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Estructura DOCX inválida.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wantedName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed, { maxOutputLength: 5 * 1024 * 1024 });
      throw new Error('El DOCX usa un método de compresión de imagen no compatible.');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
};

const readImageRelationships = (relationshipsXml, buffer) => {
  const extensions = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
  const images = [];
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)) {
    const tag = match[0];
    const type = attr(tag, 'Type');
    if (!type.endsWith('/image')) continue;
    const relationshipId = attr(tag, 'Id');
    const target = xmlUnescape(attr(tag, 'Target'));
    const entryName = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join('word', target));
    if (!entryName.startsWith('word/media/')) continue;
    const extension = path.posix.extname(entryName).toLowerCase();
    const mimeType = extensions[extension];
    if (!mimeType) continue;
    const data = getZipFileData(buffer, entryName);
    if (data?.length) images.push({ relationship_id: relationshipId, filename: path.posix.basename(entryName), mime_type: mimeType, data });
  }
  if (images.reduce((sum, image) => sum + image.data.length, 0) > 20 * 1024 * 1024) {
    throw new Error('Las imágenes del DOCX superan el máximo de 20 MB. Reduce su tamaño y vuelve a importarlo.');
  }
  return images;
};

const attr = (xml, name) => xml.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] || '';

// Word stores editable equations as Office Math Markup Language (OMML). Convert
// common structures to LaTeX so the existing KaTeX/MathJax views can render them.
const parseMathXml = (xml) => {
  const root = { name: 'root', children: [] };
  const stack = [root];
  for (const token of xml.matchAll(/<[^>]+>|[^<]+/g)) {
    const value = token[0];
    if (value.startsWith('<?') || value.startsWith('<!--') || value.startsWith('<!')) continue;
    if (value.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (value.startsWith('<')) {
      const name = value.match(/^<([^\s/>]+)/)?.[1]?.split(':').pop();
      if (!name) continue;
      const node = { name, attrs: value, children: [] };
      stack.at(-1).children.push(node);
      if (!value.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push({ name: '#text', text: xmlUnescape(value) });
  }
  return root;
};

const mathText = (node) => (node?.children || []).map((child) => child.name === '#text' ? child.text : mathText(child)).join('');
const latexSymbols = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'θ': '\\theta', 'λ': '\\lambda',
  'μ': '\\mu', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'φ': '\\phi', 'ω': '\\omega',
  'Δ': '\\Delta', 'Σ': '\\Sigma', 'Ω': '\\Omega', '×': '\\times', '÷': '\\div', '≤': '\\leq', '≥': '\\geq',
  '≠': '\\neq', '≈': '\\approx', '∞': '\\infty', '∠': '\\angle', '°': '^\\circ'
};
const convertMathSymbols = (text) => text.replace(/[αβγδεθλμπρστφωΔΣΩ×÷≤≥≠≈∞∠°]/g, (symbol) => latexSymbols[symbol]);
const child = (node, name) => node?.children?.find((part) => part.name === name);
const renderMathNode = (node) => {
  if (!node || node.name === '#text') return node?.text || '';
  const contents = () => node.children.map(renderMathNode).join('');
  const part = (name) => renderMathNode(child(node, name));
  switch (node.name) {
    case 'oMath': case 'oMathPara': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg':
    case 'fName': case 'lim': case 'mr': case 'mc': case 'mcs': return contents();
    case 't': return convertMathSymbols(mathText(node));
    case 'f': return `\\frac{${part('num')}}{${part('den')}}`;
    case 'sSup': return `${part('e')}^{${part('sup')}}`;
    case 'sSub': return `${part('e')}_{${part('sub')}}`;
    case 'sSubSup': return `${part('e')}_{${part('sub')}}^{${part('sup')}}`;
    case 'rad': {
      const degree = part('deg');
      return degree ? `\\sqrt[${degree}]{${part('e')}}` : `\\sqrt{${part('e')}}`;
    }
    case 'd': {
      const props = child(node, 'dPr');
      const begin = attr(props?.children?.find((x) => x.name === 'begChr')?.attrs || '', 'm:val') || '(';
      const end = attr(props?.children?.find((x) => x.name === 'endChr')?.attrs || '', 'm:val') || ')';
      return `\\left${begin}${part('e')}\\right${end}`;
    }
    case 'nary': {
      const props = child(node, 'naryPr');
      const symbol = attr(props?.children?.find((x) => x.name === 'chr')?.attrs || '', 'm:val');
      const commands = { '∑': '\\sum', '∫': '\\int', '∬': '\\iint', '∮': '\\oint', '∏': '\\prod' };
      const operator = commands[symbol] || symbol || '\\sum';
      return `${operator}_{${part('sub')}}^{${part('sup')}} ${part('e')}`;
    }
    case 'acc': {
      const props = child(node, 'accPr');
      const accent = attr(props?.children?.find((x) => x.name === 'chr')?.attrs || '', 'm:val');
      return `${accent === '̂' ? '\\hat' : accent === '̃' ? '\\tilde' : '\\bar'}{${part('e')}}`;
    }
    case 'bar': return `\\overline{${part('e')}}`;
    case 'func': return `${part('fName')}\\left(${part('e')}\\right)`;
    case 'r': return contents();
    default: return contents();
  }
};

const paragraphText = (paragraph) => {
  const parts = [];
  const ordered = /<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>|<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  for (const match of paragraph.matchAll(ordered)) {
    const value = match[0];
    if (value.startsWith('<m:oMathPara')) parts.push(`$$${renderMathNode(parseMathXml(value))}$$`);
    else if (value.startsWith('<m:oMath')) parts.push(`$${renderMathNode(parseMathXml(value))}$`);
    else parts.push(xmlUnescape(match[1]));
  }
  return parts.join('').trim();
};

const readNumberingFormats = (xml) => {
  const abstractFormats = new Map();
  for (const match of xml.matchAll(/<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g)) {
    const abstractId = attr(match[0].slice(0, match[0].indexOf('>') + 1), 'w:abstractNumId');
    const level = match[0].match(/<w:lvl\b[^>]*w:ilvl="0"[^>]*>[\s\S]*?<\/w:lvl>/);
    const format = level?.[0].match(/<w:numFmt\b[^>]*w:val="([^"]+)"/)?.[1] || '';
    abstractFormats.set(abstractId, format);
  }
  const formats = new Map();
  for (const match of xml.matchAll(/<w:num\b[^>]*>[\s\S]*?<\/w:num>/g)) {
    const openingTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const numId = attr(openingTag, 'w:numId');
    const abstractId = match[0].match(/<w:abstractNumId\b[^>]*w:val="([^"]+)"/)?.[1];
    formats.set(numId, abstractFormats.get(abstractId) || '');
  }
  return formats;
};

const readParagraphs = (documentXml, formats) => [...documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match, index) => {
  const paragraph = match[0];
  const text = paragraphText(paragraph);
  const numId = paragraph.match(/<w:numId\b[^>]*w:val="(\d+)"/)?.[1] || '';
  const level = paragraph.match(/<w:ilvl\b[^>]*w:val="(\d+)"/)?.[1] || '0';
  const imageIds = [...paragraph.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g)].map((part) => part[1]);
  return { index: index + 1, text, numId, level, format: formats.get(numId) || '', imageIds };
});

export const extractQuestionsFromDocx = (buffer) => {
  const documentXml = getZipEntry(buffer, 'word/document.xml');
  const numberingXml = getZipEntry(buffer, 'word/numbering.xml');
  const relationshipsXml = getZipEntry(buffer, 'word/_rels/document.xml.rels');
  const mediaFiles = readImageRelationships(relationshipsXml, buffer);
  const paragraphs = readParagraphs(documentXml, readNumberingFormats(numberingXml));
  const frequencies = new Map();
  paragraphs.forEach((paragraph) => {
    if (paragraph.format === 'decimal' && paragraph.level === '0' && paragraph.text.length >= 30) {
      frequencies.set(paragraph.numId, (frequencies.get(paragraph.numId) || 0) + 1);
    }
  });
  const candidateIds = new Set([...frequencies].filter(([, count]) => count >= 5).map(([id]) => id));
  const optionCountAfter = (index) => {
    let count = 0;
    for (let cursor = index + 1; cursor < paragraphs.length && !candidateIds.has(paragraphs[cursor].numId); cursor += 1) {
      if (paragraphs[cursor].format === 'upperLetter' && paragraphs[cursor].text) count += 1;
    }
    return count;
  };
  const questionListIds = new Set([...candidateIds].filter((id) => {
    const rows = paragraphs.filter((paragraph) => paragraph.numId === id && paragraph.text.length >= 30);
    const completeGroups = rows.filter((paragraph) => optionCountAfter(paragraphs.indexOf(paragraph)) >= 3).length;
    return rows.length >= 5 && completeGroups / rows.length >= 0.5;
  }));
  if (!questionListIds.size && candidateIds.size) {
    const best = [...candidateIds].sort((a, b) => (frequencies.get(b) || 0) - (frequencies.get(a) || 0))[0];
    questionListIds.add(best);
  }
  const questionIndexes = paragraphs.flatMap((paragraph, index) => questionListIds.has(paragraph.numId) ? [index] : []);
  const nearestQuestionIndex = (paragraphIndex) => questionIndexes.reduce((closest, candidate) => (
    Math.abs(candidate - paragraphIndex) < Math.abs(closest - paragraphIndex) ? candidate : closest
  ), questionIndexes[0]);
  if (!questionIndexes.length) {
    throw new Error('No detecté una lista numerada de preguntas. Usa la plantilla Excel/CSV para revisar el formato.');
  }

  const items = questionIndexes.map((paragraphIndex, position) => {
    const question = paragraphs[paragraphIndex];
    const nextQuestionIndex = questionIndexes[position + 1] ?? paragraphs.length;
    const following = paragraphs.slice(paragraphIndex + 1, nextQuestionIndex);
    const choices = following.filter((paragraph) => paragraph.format === 'upperLetter' && paragraph.text);
    const relatedParagraphs = paragraphs.slice(Math.max(0, paragraphIndex - 3), nextQuestionIndex);
    const imageReferences = relatedParagraphs
      .filter((paragraph) => paragraph.imageIds.length && nearestQuestionIndex(paragraph.index - 1) === paragraphIndex)
      .map((paragraph) => ({ paragraph: paragraph.index, relationship_ids: paragraph.imageIds }));
    return {
      position: position + 1,
      source_question_number: position + 1,
      source_list_id: question.numId,
      source_location: `Párrafo ${question.index}`,
      // Algunos reactivos tienen el enunciado dentro de una figura de Word.
      // Conservamos la fila en el borrador y pedimos completar el texto al revisar.
      question_text: question.text || '[Enunciado dentro de una figura del original; completar durante la revisión.]',
      option1: choices[0]?.text || '',
      option2: choices[1]?.text || '',
      option3: choices[2]?.text || '',
      option4: choices[3]?.text || '',
      correct_answer: '',
      image_references: JSON.stringify(imageReferences),
      rights_notes: 'Pendiente verificar autoría/licencia y asociar las figuras de Word.'
    };
  });
  return {
    paragraphs: paragraphs.length,
    detected_questions: items.length,
    incomplete_choices: items.filter((item) => [item.option1, item.option2, item.option3, item.option4].some((choice) => !choice)).length,
    items,
    mediaFiles
  };
};
