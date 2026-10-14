import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

// Renders the same $inline$ and $$block$$ notation accepted by question authoring.
export default function MathText({ text = '', assumeLatex = false }) {
  const value = String(text);
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
