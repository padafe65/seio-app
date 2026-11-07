import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

// Renders the same $inline$ and $$block$$ notation accepted by question authoring.
export default function MathText({ text = '', assumeLatex = false }) {
  // Some imported questions wrap ordinary answer text in LaTeX's \text{...}.
  // Remove that presentation wrapper when it is not part of a math expression.
  const rawValue = String(text);
  const repairedValue = /(?:Ã[¡-¿]|Â[¡-¿]|â€)/.test(rawValue)
    ? new TextDecoder('utf-8').decode(Uint8Array.from(rawValue, (character) => character.charCodeAt(0) & 0xff))
    : rawValue;
  const value = repairedValue.includes('$')
    ? repairedValue
    : repairedValue.replace(/\\text\{([^{}]*)\}/g, '$1');
  const latexValue = value.replace(/[π×÷≤≥≠≈∞]/g, (symbol) => ({
    'π': '\\pi', '×': '\\times', '÷': '\\div', '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx', '∞': '\\infty'
  })[symbol]);
  const parts = [];
  const expression = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let cursor = 0;
  let key = 0;
  for (const match of value.matchAll(expression)) {
    const index = match.index;
    if (index > cursor) parts.push(<React.Fragment key={key++}>{value.slice(cursor, index)}</React.Fragment>);
    parts.push(match[1] !== undefined
      ? <BlockMath key={key++} math={match[1]} />
      : <InlineMath key={key++} math={match[2]} />);
    cursor = index + match[0].length;
  }
  if (!parts.length) return assumeLatex && value.trim() ? <InlineMath math={latexValue} /> : <>{value}</>;
  if (cursor < value.length) parts.push(<React.Fragment key={key++}>{value.slice(cursor)}</React.Fragment>);
  return <>{parts}</>;
}
