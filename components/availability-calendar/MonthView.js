'use client';

import { useMemo } from 'react';

const MonthView = ({ currentDate, bookings, rooms, halls, isRoomView }) => {
  const items = isRoomView ? rooms : halls;
  const itemKey = isRoomView ? 'room_id' : 'hall_id';
  const itemNumber = isRoomView ? 'room_number' : 'hall_number';

  // Generate calendar days for the month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
            <th className="border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left text-[10px] font-semibold text-neutral-500 uppercase tracking-wider sticky left-0 z-10 min-w-[80px]">
              {isRoomView ? 'Room' : 'Hall'}
            </th>
            {dayNames.map(day => (
              <th key={day} className="border border-neutral-200 bg-neutral-50 px-1.5 py-2 text-center text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td className="border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 sticky left-0 z-10">
                {item[itemNumber]}
              </td>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return (
                    <td key={`empty-${index}`} className="border border-neutral-200 bg-neutral-50 min-w-[35px]"></td>
                  );
                }

                const booking = getBookingForDate(date, item.id);
                const isToday = date.getTime() === today.getTime();
                const dayOfMonth = date.getDate();

                // Only render cells for this week row
                const weekIndex = Math.floor(index / 7);
                const dayInWeek = index % 7;

                if (dayInWeek !== date.getDay()) {
                  return null;
                }

                return (
                  <td
                    key={date.toISOString()}
                    className={`border border-neutral-200 p-0.5 min-w-[35px] h-[40px] align-top ${
                      isToday ? 'bg-neutral-100' : 'bg-white'
                    }`}
                  >
                    <div className="text-[10px] text-neutral-500 mb-0.5">{dayOfMonth}</div>
                    {booking && (
                      <div
                        className={`text-[9px] px-0.5 py-0.5 rounded border truncate ${getStatusColor(booking.status)}`}
                        title={`${booking.bookings?.guests?.full_name || 'Guest'} - ${booking.status}`}
                      >
                        {booking.status?.replace('_', ' ').slice(0, 3)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Alternative Grid View */}
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-neutral-700 mb-2">Calendar Grid</h3>
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center text-[10px] font-semibold text-neutral-600 py-1.5 bg-neutral-50 rounded">
              {day}
            </div>
          ))}

          {/* Calendar Cells */}
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[65px] bg-neutral-50 rounded"></div>;
            }

            const isToday = date.getTime() === today.getTime();
            const dayOfMonth = date.getDate();

            // Get all bookings for this date
            const dayBookings = items.map(item => ({
              item,
              booking: getBookingForDate(date, item.id)
            })).filter(b => b.booking);

            return (
              <div
                key={date.toISOString()}
                className={`min-h-[65px] p-1.5 rounded border ${
                  isToday
                    ? 'bg-neutral-100 border-neutral-400'
                    : 'bg-white border-neutral-200'
                }`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-neutral-900' : 'text-neutral-700'}`}>
                  {dayOfMonth}
                </div>
                <div className="space-y-0.5">
                  {dayBookings.slice(0, 2).map(({ item, booking }) => (
                    <div
                      key={`${item.id}-${booking.id}`}
                      className={`text-[9px] px-0.5 py-0.5 rounded border truncate ${getStatusColor(booking.status)}`}
                      title={`${item[itemNumber]} - ${booking.bookings?.guests?.full_name || 'Guest'}`}
                    >
                      {item[itemNumber]}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <div className="text-[9px] text-neutral-500">+{dayBookings.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthView;
