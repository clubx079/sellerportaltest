'use client';

import { useMemo } from 'react';

const DayView = ({ currentDate, bookings, rooms, halls, isRoomView }) => {
  const items = isRoomView ? rooms : halls;
  const itemKey = isRoomView ? 'room_id' : 'hall_id';
  const itemNumber = isRoomView ? 'room_number' : 'hall_number';

  // Generate hours for the day
  const hours = useMemo(() => {
    const hoursArray = [];
    for (let i = 0; i < 24; i++) {
      hoursArray.push(i);
    }
    return hoursArray;
  }, []);

  // Check if an hour has a booking for a specific item
  const getBookingForHour = (hour, itemId) => {
    const dateStart = new Date(currentDate);
    dateStart.setHours(hour, 0, 0, 0);
    const dateEnd = new Date(currentDate);
    dateEnd.setHours(hour, 59, 59, 999);

    return bookings.find(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const bookingItemId = booking[itemKey];

      return bookingItemId === itemId &&
             checkIn <= dateEnd &&
             checkOut >= dateStart;
    });
  };

  // Get booking for the entire day
  const getBookingForDay = (itemId) => {
    const dateStart = new Date(currentDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(currentDate);
    dateEnd.setHours(23, 59, 59, 999);

    return bookings.find(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const bookingItemId = booking[itemKey];

      return bookingItemId === itemId &&
             checkIn <= dateEnd &&
             checkOut >= dateStart;
    });
  };

  // Get status color classes
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'booked':
        return 'bg-red-100 border-red-300 text-red-700';
      case 'checked_in':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      case 'checked_out':
        return 'bg-neutral-200 border-neutral-300 text-neutral-600';
      default:
        return 'bg-green-100 border-green-300 text-green-700';
    }
  };

  const formatHour = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDateStart = new Date(currentDate);
  currentDateStart.setHours(0, 0, 0, 0);
  const isToday = currentDateStart.getTime() === today.getTime();
  const currentHour = new Date().getHours();

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">No {isRoomView ? 'rooms' : 'halls'} found for this type</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {items.map(item => {
          const booking = getBookingForDay(item.id);

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 ${
                booking
                  ? getStatusColor(booking.status)
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold">{item[itemNumber]}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  booking
                    ? 'bg-white/50'
                    : 'bg-green-200 text-green-800'
                }`}>
                  {booking ? booking.status?.replace('_', ' ').toUpperCase() : 'AVAILABLE'}
                </span>
              </div>
              {booking && (
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate">
                    {booking.bookings?.users?.full_name || 'Guest'}
                  </p>
                  <p className="text-xs">
                    Check-in: {new Date(booking.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs">
                    Check-out: {new Date(booking.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {!booking && (
                <p className="text-sm text-green-700">Available all day</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Hourly Timeline */}
      <h3 className="text-sm font-bold text-neutral-700 mb-3">Hourly Timeline</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm font-bold text-neutral-700 sticky left-0 z-10 min-w-[120px]">
                {isRoomView ? 'Room' : 'Hall'}
              </th>
              {hours.map(hour => (
                <th
                  key={hour}
                  className={`border border-neutral-200 px-1 py-2 text-center text-xs font-medium min-w-[60px] ${
                    isToday && hour === currentHour
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'bg-neutral-50 text-neutral-600'
                  }`}
                >
                  {formatHour(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 sticky left-0 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neutral-500"></div>
                    {item[itemNumber]}
                  </div>
                </td>
                {hours.map(hour => {
                  const booking = getBookingForHour(hour, item.id);
                  const isCurrentHour = isToday && hour === currentHour;

                  return (
                    <td
                      key={hour}
                      className={`border border-neutral-200 p-1 min-w-[60px] h-[50px] ${
                        isCurrentHour ? 'bg-neutral-100' : 'bg-white'
                      }`}
                    >
                      {booking ? (
                        <div
                          className={`h-full rounded border text-xs flex items-center justify-center ${getStatusColor(booking.status)}`}
                          title={`${booking.bookings?.guests?.full_name || 'Guest'} - ${booking.status}`}
                        >
                          {booking.status?.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="h-full rounded border border-dashed border-green-200 bg-green-50"></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DayView;
