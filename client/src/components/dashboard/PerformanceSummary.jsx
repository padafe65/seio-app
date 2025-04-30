// components/dashboard/PerformanceSummary.jsx

import React from 'react';

const PerformanceSummary = ({ subjects }) => {
  const getColorClass = (percentage) => {
    if (percentage >= 90) return 'bg-success';
    if (percentage >= 80) return 'bg-primary';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-error';
  };

  const getTextColorClass = (percentage) => {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 80) return 'text-primary';
    if (percentage >= 70) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-800">Rendimiento por Materia</h2>
      </div>
      
      <div className="p-5 space-y-4">
        {subjects.map((subject) => (
          <div key={subject.subject}>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-medium text-gray-700">{subject.subject}</h3>
              <span className={`text-sm font-medium ${getTextColorClass(subject.percentage)}`}>
                {subject.percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`${getColorClass(subject.percentage)} h-1.5 rounded-full`} 
                style={{ width: `${subject.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceSummary;
