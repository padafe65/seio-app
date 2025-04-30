import React from 'react';

const EventsList = ({ events }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-800">Próximos Eventos</h2>
      </div>
      
      <div className="p-5 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="flex space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex flex-col items-center justify-center">
              <span className="text-primary text-xs font-bold">{event.date.month}</span>
              <span className="text-primary text-lg font-bold">{event.date.day}</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">{event.title}</h3>
              <p className="text-xs text-gray-500">{event.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsList;
