// components/dashboard/StatsCard.jsx

import React from 'react';

const StatsCard = ({ title, value, unit, trend, icon }) => {
  const trendStyles = trend
    ? trend.positive
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'
    : '';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
        {trend && (
          <span className={`text-xs font-semibold py-1 px-2 rounded-full ${trendStyles}`}>
            {trend.value} {trend.positive ? '🔼' : '🔽'}
          </span>
        )}
      </div>
      <div className="flex items-end space-x-2">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{unit}</p>
      </div>
    </div>
  );
};

export default StatsCard;
  