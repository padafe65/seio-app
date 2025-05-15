import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const QuestionEditor = ({ question, index, onChange, onRemove }) => {
  const [isOpen, setIsOpen] = useState(index === 0);
  
  const handleQuestionTextChange = (e) => {
    onChange({
      ...question,
      text: e.target.value
    });
  };
  
  const handleOptionTextChange = (optionIndex, value) => {
    const updatedOptions = [...question.options];
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      text: value
    };
    
    onChange({
      ...question,
      options: updatedOptions
    });
  };
  
  const handleCorrectOptionChange = (optionIndex) => {
    const updatedOptions = question.options.map((option, idx) => ({
      ...option,
      is_correct: idx === optionIndex
    }));
    
    onChange({
      ...question,
      options: updatedOptions
    });
  };
  
  const handleExplanationChange = (e) => {
    onChange({
      ...question,
      explanation: e.target.value
    });
  };
  
  return (
    <div className="accordion-item">
      <div className="d-flex align-items-center">
        <h2 className="accordion-header flex-grow-1" id={`heading${index}`}>
          <button 
            className={`accordion-button ${!isOpen ? 'collapsed' : ''}`}
            type="button" 
            onClick={() => setIsOpen(!isOpen)}
          >
            <strong>Pregunta {index + 1}:</strong> 
            <span className="ms-2">
              {question.text ? (question.text.substring(0, 50) + (question.text.length > 50 ? '...' : '')) : 'Nueva pregunta'}
            </span>
          </button>
        </h2>
        <div className="p-2">
          <button 
            type="button" 
            className="btn btn-outline-danger btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div 
        id={`collapse${index}`}
        className={`accordion-collapse collapse ${isOpen ? 'show' : ''}`}
        aria-labelledby={`heading${index}`}
      >
        <div className="accordion-body">
          <div className="mb-3">
            <label className="form-label">Texto de la pregunta</label>
            <textarea
              className="form-control"
              value={question.text || ''}
              onChange={handleQuestionTextChange}
              rows="2"
              required
            />
          </div>
          
          <div className="mb-3">
            <label className="form-label">Opciones de respuesta</label>
            {question.options.map((option, optIndex) => (
              <div key={optIndex} className="input-group mb-2">
                <div className="input-group-text">
                  <input
                    type="radio"
                    name={`correct_option_${index}`}
                    checked={option.is_correct}
                    onChange={() => handleCorrectOptionChange(optIndex)}
                    required
                  />
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Opción ${optIndex + 1}`}
                  value={option.text || ''}
                  onChange={(e) => handleOptionTextChange(optIndex, e.target.value)}
                  required
                />
              </div>
            ))}
            <div className="form-text text-muted">
              Selecciona el botón de radio junto a la opción correcta.
            </div>
          </div>
          
          <div className="mb-3">
            <label className="form-label">Explicación (opcional)</label>
            <textarea
              className="form-control"
              value={question.explanation || ''}
              onChange={handleExplanationChange}
              rows="2"
              placeholder="Explica por qué esta es la respuesta correcta"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
