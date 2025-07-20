const Calendar = ({ user, setPage }) => {
  const [events, setEvents] = React.useState([]);
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(getCurrentDateTime());
  const [showAddEventForm, setShowAddEventForm] = React.useState(false);
  const [accessibleUsers, setAccessibleUsers] = React.useState([]);
  const [selectedUsers, setSelectedUsers] = React.useState([user.username]);
  const [userProfiles, setUserProfiles] = React.useState({ [user.username]: user.profilePicUrl });
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState('all');
  const calendarRef = React.useRef(null);

  const fetchAccessibleUsers = async () => {
    try {
      const response = await axios.get('https://ourlife.work.gd:8443/api/get-access', {
        params: { viewer: user.username },
        timeout: 5000
      });
      if (response.data.success) {
        const accessible = [
          user.username,
          ...response.data.accessList
            .filter(access => access.viewer === user.username)
            .map(access => access.target),
        ];
        setAccessibleUsers(accessible);
        setSelectedUsers(accessible);
        const profiles = { [user.username]: user.profilePicUrl || DEFAULT_PROFILE_PIC_URL };
        for (const username of accessible) {
          if (username !== user.username) {
            try {
              const profileResponse = await axios.get(
                `https://ourlife.work.gd:8443/api/profile-pictures?username=${username}`,
                { timeout: 5000 }
              );
              profiles[username] = profileResponse.data.profilePicUrl || DEFAULT_PROFILE_PIC_URL;
            } catch (err) {
              profiles[username] = DEFAULT_PROFILE_PIC_URL;
              console.error(`Error fetching profile for ${username}:`, err);
            }
          }
        }
        setUserProfiles(profiles);
      }
    } catch (err) {
      console.error('Error fetching accessible users:', err);
      setAccessibleUsers([user.username]);
      setSelectedUsers([user.username]);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get('https://ourlife.work.gd:8443/api/calendar', {
        params: { user: user.username },
        timeout: 5000
      });
      setEvents(response.data);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    }
  };

  const addEvent = async () => {
    if (!title || !date) return;
    const event = {
      user: user.username,
      title,
      date,
      financial: false,
      eventColor: user.eventColor,
    };
    try {
      await axios.post('https://ourlife.work.gd:8443/api/calendar', event, { timeout: 5000 });
      fetchEvents();
      setTitle('');
      setDate(getCurrentDateTime());
      setShowAddEventForm(false);
    } catch (err) {
      console.error('Error adding calendar event:', err);
    }
  };

  const deleteEvent = async (id) => {
    try {
      await axios.delete(`https://ourlife.work.gd:8443/api/calendar/${id}`, { timeout: 5000 });
      fetchEvents();
      setShowEventModal(false);
    } catch (err) {
      console.error('Error deleting calendar event:', err);
    }
  };

  const toggleUser = (username) => {
    setSelectedUsers(prev =>
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
    );
  };

  React.useEffect(() => {
    fetchAccessibleUsers();
    fetchEvents();
  }, [user]);

  React.useEffect(() => {
    if (calendarRef.current) {
      const calendar = new FullCalendar.Calendar(calendarRef.current, {
        initialView: 'dayGridMonth',
        events: events
          .filter(event => selectedUsers.includes(event.user))
          .filter(event => event.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .filter(event => filterType === 'all' || (event.financial ? event.type === filterType : filterType === 'event'))
          .map(event => ({
            id: event.id,
            title: event.title,
            start: event.date,
            backgroundColor: event.eventColor || user.eventColor,
            borderColor: event.eventColor || user.eventColor,
            extendedProps: { user: event.user, financial: event.financial, type: event.type, amount: event.amount },
          })),
        eventContent: (arg) => {
          const { event } = arg;
          return {
            html: `
              <div class="fc-event-main">
                <div class="event-profile-pic-container">
                  <img src="${userProfiles[event.extendedProps.user] || DEFAULT_PROFILE_PIC_URL}" alt="${event.extendedProps.user}'s profile" class="event-profile-pic" />
                </div>
                <div class="fc-event-title">${event.title}</div>
                <div className="fc-event-user">${capitalizeFirstLetter(event.extendedProps.user)}</div>
                ${event.financial ? `<div class="fc-event-amount">${event.extendedProps.amount ? `R${event.extendedProps.amount.toFixed(2)}` : ''}</div>` : ''}
              </div>
            `
          };
        },
        eventClick: (info) => {
          setSelectedEvent({
            id: info.event.id,
            title: info.event.title,
            date: info.event.start.toISOString(),
            user: info.event.extendedProps.user,
            financial: info.event.extendedProps.finance,
            type: info.event.extendedProps.type,
            amount: info.event.extendedProps.amount,
          });
          setShowEventModal(true);
        },
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
      });
      calendar.render();
      return () => calendar.destroy();
    }
  }, [events, selectedUsers, userProfiles, searchQuery, filterType, user.eventColor]);

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8">
        <h1 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
          <div className="profile-pic-container">
            <img
              src={user.profilePicUrl || DEFAULT_PROFILE_PIC_URL}
              alt={`${user.username}'s profile`}
              className="profile-pic"
            />
          </div>
          <span>Calendar</span>
        </h1>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={() => setShowAddEventForm(!showAddEventForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              aria-label={showAddEventForm ? 'Hide Add Event Form' : 'Show Add Event Form'}
            >
              {showAddEventForm ? 'Hide Form' : 'Add Event'}
            </button>
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by event title"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Search calendar events"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Filter by type"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="event">Events</option>
            </select>
          </div>
        </div>
        {showAddEventForm && (
          <div className="mb-6 p-4 card">
            <input
              type="text"
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Event title"
            />
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Event date"
            />
            <button
              onClick={addEvent}
              className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              aria-label="Add Event"
            >
              Add Event
            </button>
          </div>
        )}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Filter by User</h2>
          <div className="flex flex-wrap gap-2">
            {accessibleUsers.map((username) => (
              <label key={username} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(username)}
                  onChange={() => toggleUser(username)}
                  className="rounded text-teal-500 focus:ring-teal-400"
                  aria-label={`Filter by ${username}`}
                />
                <div className="event-profile-pic-container">
                  <img
                    src={userProfiles[username] || DEFAULT_PROFILE_PIC_URL}
                    alt={`${username}'s profile`}
                    className="event-profile-pic"
                  />
                </div>
                <span>{capitalizeFirstLetter(username)}</span>
              </label>
            ))}
          </div>
        </div>
        <div ref={calendarRef} className="mb-6"></div>
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="card p-6 max-w-sm w-full modal show">
              <h2 className="text-xl font-semibold text-white mb-4">Event Details</h2>
              <p><strong>Title:</strong> {selectedEvent.title}</p>
              <p><strong>User:</strong> {capitalizeFirstLetter(selectedEvent.user)}</p>
              <p><strong>Date:</strong> {formatDateTimeWithSeconds(selectedEvent.date)}</p>
              {selectedEvent.financial && (
                <>
                  <p><strong>Type:</strong> {capitalizeFirstLetter(selectedEvent.type)}</p>
                  <p><strong>Amount:</strong> R{selectedEvent.amount?.toFixed(2) || 'N/A'}</p>
                </>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  aria-label="Close event modal"
                >
                  Close
                </button>
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  aria-label="Delete event"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setPage('menu')}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          aria-label="Back to Menu"
        >
          Back to Menu
        </button>
      </section>
    </main>
  );
};
