export const calculateScore = (expression) => {
  try {
    // Esta es una implementación muy básica y segura.
    // Asume un formato como "(numerador / denominador) * factor".
    const match = expression.match(/\((\d+)\s*\/\s*(\d+)\)\s*\*\s*(\d+)/);
    if (match) {
      const numerator = parseInt(match[1], 10);
      const denominator = parseInt(match[2], 10);
      const factor = parseInt(match[3], 10);
      if (denominator === 0) return 0;
      return (numerator / denominator) * factor;
    }
    return 0;
  } catch (error) {
    console.error('Error calculating score:', error);
    return 0;
  }
};
