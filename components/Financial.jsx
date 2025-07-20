const Financial = ({ user, setPage }) => {
  const [items, setItems] = React.useState([]);
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [type, setType] = React.useState('income');
  const [date, setDate] = React.useState(getCurrentDateTime());
  const [hideValues, setHideValues] = React.useState(false);
  const [currency, setCurrency] = React.useState('ZAR');
  const [accessibleUsers, setAccessibleUsers] = React.useState([]);
  const [selectedUsers, setSelectedUsers] = React.useState([user.username]);
  const [userProfiles, setUserProfiles] = React.useState({ [user.username]: user.profilePicUrl });
  const [showAddItemForm, setShowAddItemForm] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState('07');
  const [netTotal, setNetTotal] = React.useState(0);
  const [bulkData, setBulkData] = React.useState('');
  const [importMessage, setImportMessage] = React.useState('');
  const [showImportTool, setShowImportTool] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState('all');

  const currencyConfig = {
    USD: { symbol: '$', rate: 1 },
    EUR: { symbol: '€', rate: 0.85 },
    ZAR: { symbol: 'R', rate: 18.5 },
  };
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  const formatAmount = (amount) => {
    return `${currencyConfig[currency].symbol}${parseFloat(amount).toFixed(2)}`;
  };
  const calculateNetTotal = () => {
    const filteredItems = items
      .filter(item => selectedUsers.includes(item.user))
      .filter(item => item.date.startsWith(`2025-${selectedMonth}`))
      .filter(item => item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(item => filterType === 'all' || item.type === filterType);
    const total = filteredItems.reduce((sum, item) => {
      return item.type === 'income' ? sum + item.amount : sum - item.amount;
    }, 0);
    setNetTotal(total);
  };
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
  const fetchItems = async () => {
    try {
      const response = await axios.get('https://ourlife.work.gd:8443/api/financial', {
        params: { user: user.username },
        timeout: 5000
      });
      setItems(response.data);
    } catch (err) {
      console.error('Error fetching financial items:', err);
    }
  };
  const addItem = async () => {
    if (!description || !amount || !date) return;
    const item = {
      user: user.username,
      description,
      amount: parseFloat(amount),
      type,
      date,
    };
    try {
      await axios.post('https://ourlife.work.gd:8443/api/financial', item, { timeout: 5000 });
      await axios.post('https://ourlife.work.gd:8443/api/calendar', {
        user: user.username,
        title: `${description} (${type})`,
        date,
        financial: true,
        type,
        amount: parseFloat(amount),
        eventColor: user.eventColor,
      }, { timeout: 5000 });
      fetchItems();
      setDescription('');
      setAmount('');
      setDate(getCurrentDateTime());
      setShowAddItemForm(false);
    } catch (err) {
      console.error('Error adding financial item:', err);
    }
  };
  const deleteItem = async (id) => {
    try {
      await axios.delete(`https://ourlife.work.gd:8443/api/financial/${id}`, { timeout: 5000 });
      fetchItems();
    } catch (err) {
      console.error('Error deleting financial item:', err);
    }
  };
  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      setImportMessage('Please paste data into the text box.');
      return;
    }
    const lines = bulkData.trim().split('\n').filter(line => line.trim() !== '');
    const itemsToImport = lines
      .map(line => {
        const [description, amount, type, date] = line.split(',').map(field => field.trim());
        if (!description || !amount || !type || !date) return null;
        return { user: user.username, description, amount: parseFloat(amount), type, date };
      })
      .filter(Boolean);
    if (itemsToImport.length === 0) {
      setImportMessage('No valid data found. Please check the format.');
      return;
    }
    setImportMessage(`Importing ${itemsToImport.length} items...`);
    try {
      const importPromises = itemsToImport.map(item => {
        const financialPromise = axios.post('https://ourlife.work.gd:8443/api/financial', item, { timeout: 5000 });
        const calendarPromise = axios.post('https://ourlife.work.gd:8443/api/calendar', {
          user: user.username,
          title: `${item.description} (${item.type})`,
          date: item.date,
          financial: true,
          type: item.type,
          amount: item.amount,
          eventColor: user.eventColor,
        }, { timeout: 5000 });
        return Promise.all([financialPromise, calendarPromise]);
      });
      await Promise.all(importPromises);
      setImportMessage(`Successfully imported ${itemsToImport.length} items!`);
      setBulkData('');
      setShowImportTool(false);
      fetchItems();
    } catch (err) {
      setImportMessage('An error occurred during import. Please check the data and try again.');
      console.error('Bulk import error:', err);
    }
  };
  const toggleUser = (username) => {
    setSelectedUsers(prev =>
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
    );
  };
  React.useEffect(() => {
    fetchAccessibleUsers();
    fetchItems();
  }, []);
  React.useEffect(() => {
    calculateNetTotal();
  }, [items, selectedUsers, selectedMonth, searchQuery, filterType]);

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
          <span>Finances</span>
        </h1>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex space-x-3 w-full sm:w-auto">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Select Month"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label} 2025
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAddItemForm(!showAddItemForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              aria-label={showAddItemForm ? 'Hide Add Item Form' : 'Show Add Item Form'}
            >
              {showAddItemForm ? 'Hide Form' : 'Add Item'}
            </button>
            <button
              onClick={() => setShowImportTool(!showImportTool)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              aria-label={showImportTool ? 'Hide Import Tool' : 'Show Import Tool'}
            >
              {showImportTool ? 'Hide Import' : 'Bulk Import'}
            </button>
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by description"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Search financial items"
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
            </select>
          </div>
        </div>
        {showAddItemForm && (
          <div className="mb-6 p-4 card">
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Financial item description"
            />
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Financial item amount"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Financial item type"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Financial item date"
            />
            <button
              onClick={addItem}
              className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              aria-label="Add Financial Item"
            >
              Add Item
            </button>
          </div>
        )}
        {showImportTool && (
          <div className="mb-6 p-4 card">
            <textarea
              placeholder="Paste CSV data (description,amount,type,date)"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              rows="5"
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Bulk import data"
            ></textarea>
            <button
              onClick={handleBulkImport}
              className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              aria-label="Import Financial Data"
            >
              Import Data
            </button>
            {importMessage && (
              <p className={`text-center text-sm mt-2 ${importMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {importMessage}
              </p>
            )}
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
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Financial Summary</h2>
          <p className="text-white">Net Total: {formatAmount(netTotal)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-300">
                <th className="p-3">User</th>
                <th className="p-3">Description</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Type</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(item => selectedUsers.includes(item.user))
                .filter(item => item.date.startsWith(`2025-${selectedMonth}`))
                .filter(item => item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                .filter(item => filterType === 'all' || item.type === filterType)
                .map(item => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="p-3 flex items-center gap-2">
                      <div className="event-profile-pic-container">
                        <img
                          src={userProfiles[item.user] || DEFAULT_PROFILE_PIC_URL}
                          alt={`${item.user}'s profile`}
                          className="event-profile-pic"
                        />
                      </div>
                      {capitalizeFirstLetter(item.user)}
                    </td>
                    <td className="p-3">{item.description}</td>
                    <td className="p-3">{hideValues ? '****' : formatAmount(item.amount)}</td>
                    <td className="p-3">{capitalizeFirstLetter(item.type)}</td>
                    <td className="p-3">{formatDateTimeWithSeconds(item.date)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-500"
                        aria-label={`Delete financial item ${item.description}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => setHideValues(!hideValues)}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          aria-label={hideValues ? 'Show Values' : 'Hide Values'}
        >
          {hideValues ? 'Show Values' : 'Hide Values'}
        </button>
      </section>
    </main>
  );
};
