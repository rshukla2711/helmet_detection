import React, { useEffect, useState } from 'react';

function App() {
  const [detections, setDetections] = useState([]);
  const [filteredDetections, setFilteredDetections] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:5000');

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
      const newDetections = JSON.parse(event.data).map(detection => {
        const dateObj = new Date(detection.timestamp);
        const date = dateObj.toLocaleDateString('en-GB'); 
        const time = dateObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        return {
          ...detection,
          date,
          time,
          location: detection.Location // Assuming the location field is present in the data
        };
      });

      setDetections(newDetections);

      const uniqueLocations = [...new Set(newDetections.map(d => d.location))].sort();
      setLocations(uniqueLocations);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };

    // Cleanup on component unmount
    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    let filtered = detections;

    if (locationFilter) {
      filtered = filtered.filter(detection => detection.location === locationFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter(detection => detection.date === dateFilter);
    }

    setFilteredDetections(filtered.slice(0, 100)); // Limit to the latest 100 detections
  }, [locationFilter, dateFilter, detections]);

  const handleDateChange = (e) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const [year, month, day] = dateValue.split('-');
      setDateFilter(`${day}/${month}/${year}`);
    } else {
      setDateFilter('');
    }
  };

  const getFormattedDate = (date) => {
    if (!date) return '';
    const [day, month, year] = date.split('/');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="overflow-x-hidden antialiased selection:bg-cyan-300 selection:text-cyan-900">
      <div className="absolute top-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-50 blur-[80px]"></div>
      </div>
      <div className="">
        <h1 className="my-5 text-center text-4xl">Latest 100 Detections</h1>
        <div className="text-center mb-4">
          <label htmlFor="location-filter" className="mr-2 text-lg">Filter by Location:</label>
          <select
            id="location-filter"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="border border-gray-300 px-2 py-1 rounded"
          >
            <option value="">All Locations</option>
            {locations.map((location, index) => (
              <option key={index} value={location}>{location}</option>
            ))}
          </select>
        </div>
        <div className="text-center mb-4">
          <label htmlFor="date-filter" className="mr-2 text-lg">Filter by Date:</label>
          <input
            id="date-filter"
            type="date"
            value={getFormattedDate(dateFilter)}
            onChange={handleDateChange}
            className="border border-gray-300 px-2 py-1 rounded"
          />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Time
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDetections.map((detection, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{detection.date}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{detection.time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{detection.location}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
