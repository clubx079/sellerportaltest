'use client';

import { useMemo } from 'react';

const WeekView = ({ currentDate, bookings, rooms, halls, isRoomView }) => {
  const items = isRoomView ? rooms : halls;
  const itemKey = isRoomView ? 'room_id' : 'hall_id';
  const itemNumber = isRoomView ? 'room_number' : 'hall_number';

  // Generate week days
  const weekDays = useMemo(() => {
    const date = new Date(currentDate);
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  // Check if a date has a booking for a specific item
  const getBookingForDate = (date, itemId) => {
    if (!date) return null;

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
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

  const formatDayHeader = (date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return { dayName, dayNum, month };
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">No {isRoomView ? 'rooms' : 'halls'} found for this type</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm font-bold text-neutral-700 sticky left-0 z-10 min-w-[120px]">
              {isRoomView ? 'Room' : 'Hall'}
            </th>
            {weekDays.map(date => {
              const { dayName, dayNum, month } = formatDayHeader(date);
              const isToday = date.getTime() === today.getTime();

              return (
                <th
                  key={date.toISOString()}
                  className={`border border-neutral-200 px-2 py-3 text-center min-w-[120px] ${
                    isToday
                      ? 'bg-neutral-100'
                      : 'bg-neutral-50'
                  }`}
                >
                  <div className="text-sm font-bold text-neutral-700">{dayName}</div>
                  <div className={`text-lg font-bold ${isToday ? 'text-neutral-900' : 'text-neutral-800'}`}>
                    {dayNum}
                  </div>
                  <div className="text-xs text-neutral-500">{month}</div>
                </th>
              );
            })}
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
              {weekDays.map(date => {
                const booking = getBookingForDate(date, item.id);
                const isToday = date.getTime() === today.getTime();

                return (
                  <td
                    key={date.toISOString()}
                    className={`border border-neutral-200 p-2 min-w-[120px] h-[80px] align-top ${
                      isToday ? 'bg-neutral-100' : 'bg-white'
                    }`}
                  >
                    {booking ? (
                      <div
                        className={`h-full rounded-lg border p-2 ${getStatusColor(booking.status)}`}
                      >
                        <div className="text-xs font-bold truncate">
                          {booking.bookings?.guests?.full_name || 'Guest'}
                        </div>
                        <div className="text-xs mt-1 capitalize">
                          {booking.status?.replace('_', ' ')}
                        </div>
                        <div className="text-xs mt-1 text-neutral-500">
                          {new Date(booking.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full rounded-lg border border-dashed border-green-300 bg-green-50 flex items-center justify-center">
                        <span className="text-xs text-green-600 font-medium">Available</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeekView;
