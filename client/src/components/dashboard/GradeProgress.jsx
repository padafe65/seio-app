import React from 'react';

const GradeProgress = ({ grades }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">Progreso de Fases por Grado</h2>
          <button className="text-primary hover:text-primary-dark font-medium text-sm">Ver Detalle</button>
        </div>
      </div>
      
      <div className="p-6">
        {grades.map((grade, index) => (
          <div key={grade.grade} className={index < grades.length - 1 ? 'mb-6' : ''}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700">Grado {grade.grade}</h3>
              <span className="text-sm text-gray-500">{grade.progress}% completado</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${grade.progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>Fase 1</span>
              <span>Fase 2</span>
              <span>Fase 3</span>
              <span>Fase 4</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GradeProgress;
