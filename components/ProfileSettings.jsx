const ProfileSettings = ({ user, setPage }) => {
  const [profilePicUrl, setProfilePicUrl] = React.useState(user.profilePicUrl || '');
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [email, setEmail] = React.useState(user.email || '');
  const [phone, setPhone] = React.useState(user.phone || '');
  const [address, setAddress] = React.useState(user.address || '');
  const [eventColor, setEventColor] = React.useState(user.eventColor || DEFAULT_EVENT_COLOR);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [passwordMessage, setPasswordMessage] = React.useState('');
  const [allUsers, setAllUsers] = React.useState([]);
  const [targetUsername, setTargetUsername] = React.useState('');
  const [accessList, setAccessList] = React.useState([]);
  const [accessMessage, setAccessMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setProfilePicUrl(user.profilePicUrl || DEFAULT_PROFILE_PIC_URL);
      setMessage('');
    }
  };

  const handleSaveProfile = async () => {
    setMessage('Saving...');
    let urlToSave = profilePicUrl;
    try {
      if (selectedFile) {
        urlToSave = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } else if (!profilePicUrl) {
        urlToSave = DEFAULT_PROFILE_PIC_URL;
      }
      const response = await axios.post('https://ourlife.work.gd:8443/api/profile-pictures', {
        username: user.username,
        profilePicUrl: urlToSave,
        email,
        phone,
        address,
        eventColor,
      }, { timeout: 5000 });
      if (response.data.success) {
        setMessage('Profile saved successfully!');
        user.profilePicUrl = urlToSave;
        user.email = email;
        user.phone = phone;
        user.address = address;
        user.eventColor = eventColor;
      } else {
        setMessage(response.data.message || 'Failed to save profile.');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error saving profile.');
      console.error('Error saving profile:', err);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMessage('All password fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters.');
      return;
    }
    setPasswordMessage('Changing password...');
    try {
      const response = await axios.post('https://ourlife.work.gd:8443/api/update-password', {
        username: user.username,
        currentPassword,
        newPassword
      }, { timeout: 5000 });
      if (response.data.success) {
        setPasswordMessage('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordMessage(response.data.message || 'Failed to update password.');
      }
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || 'Error updating password.');
      console.error('Error updating password:', err);
    }
  };

  const fetchAllUsers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('https://ourlife.work.gd:8443/api/users', {
        timeout: 5000
      });
      if (Array.isArray(response.data)) {
        const filteredUsers = response.data
          .filter(u => u.username && u.username !== user.username)
          .map(u => u.username);
        setAllUsers(filteredUsers);
        console.log('Fetched users:', filteredUsers);
      } else {
        setAccessMessage('Failed to fetch users: Invalid response format.');
        console.error('Invalid users response:', response.data);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error fetching users';
      setAccessMessage(`Error fetching users: ${errorMessage}`);
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccessList = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('https://ourlife.work.gd:8443/api/get-access', {
        timeout: 5000
      });
      if (response.data.success && Array.isArray(response.data.accessList)) {
        const userAccessList = response.data.accessList
          .filter(access => access.viewer === user.username && access.target !== user.username);
        setAccessList(userAccessList);
        console.log('Fetched access list:', userAccessList);
      } else {
        setAccessMessage(`Failed to fetch access list: ${response.data.message || 'Invalid response format'}`);
        console.error('Invalid access list response:', response.data);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error fetching access list';
      setAccessMessage(`Error fetching access list: ${errorMessage}`);
      console.error('Error fetching access list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!targetUsername) {
      setAccessMessage('Please select a target user.');
      return;
    }
    setAccessMessage('Granting access...');
    try {
      const response = await axios.post('https://ourlife.work.gd:8443/api/grant-access', {
        viewer: user.username,
        target: targetUsername
      }, { timeout: 5000 });
      if (response.data.success) {
        setAccessMessage('Access granted successfully!');
        setTargetUsername('');
        await fetchAccessList();
      } else {
        setAccessMessage(response.data.message || 'Failed to grant access.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error granting access';
      setAccessMessage(`Error granting access: ${errorMessage}`);
      console.error('Error granting access:', err);
    }
  };

  const handleRevokeAccess = async (viewer, target) => {
    setAccessMessage('Revoking access...');
    try {
      const response = await axios.post('https://ourlife.work.gd:8443/api/revoke-access', {
        viewer,
        target
      }, { timeout: 5000 });
      if (response.data.success) {
        setAccessMessage('Access revoked successfully!');
        await fetchAccessList();
      } else {
        setAccessMessage(response.data.message || 'Failed to revoke access.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error revoking access';
      setAccessMessage(`Error revoking access: ${errorMessage}`);
      console.error('Error revoking access:', err);
    }
  };

  React.useEffect(() => {
    if (user?.isAdmin) {
      console.log('Admin user detected, fetching access data...');
      fetchAllUsers();
      fetchAccessList();
    }
  }, [user]);

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8">
        <h1 className="text-2xl font-semibold text-white mb-6">Profile Settings</h1>
        <div className="space-y-6">
          <div>
            <label className="block text-white text-lg font-medium mb-2" htmlFor="profilePic">Profile Picture</label>
            <div className="flex items-center gap-4 mb-4">
              <div className="profile-pic-container">
                <img src={profilePicUrl || DEFAULT_PROFILE_PIC_URL} alt={`${user.username}'s profile`} className="profile-pic" />
              </div>
              <span className="teP0+r\P0+r\P0+r\P0+r\P0+r\P0+r\P0+r\xt-white">{user.username}</span>
            </div>
            <input
              id="profilePic"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full p-3 rounded-lg bg-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600"
              aria-label="Upload Profile Picture"
            />
          </div>
          <div>
            <label className="block text-white text-lg font-medium mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Email"
            />
          </div>
          <div>
            <label className="block text-white text-lg font-medium mb-2" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Phone Number"
            />
          </div>
          <div>
            <label className="block text-white text-lg font-medium mb-2" htmlFor="address">Address</label>
            <textarea
              id="address"
              placeholder="Enter your address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows="3"
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
              aria-label="Address"
            ></textarea>
          </div>
          <div>
            <label className="block text-white text-lg font-medium mb-2" htmlFor="eventColor">Event Color</label>
            <input
              id="eventColor"
              type="color"
              value={eventColor}
              onChange={(e) => setEventColor(e.target.value)}
              className="w-full h-12 rounded-lg bg-white/10 text-white cursor-pointer"
              aria-label="Event Color"
            />
          </div>
          {message && (
            <p className={`text-center text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
          <button
            onClick={handleSaveProfile}
            className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            aria-label="Save Profile"
          >
            Save Profile
          </button>
          <div className="pt-6 border-t border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Change Password</h2>
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Current Password"
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="New Password"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400 mb-4"
              aria-label="Confirm New Password"
            />
            {passwordMessage && (
              <p className={`text-center text-sm ${passwordMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {passwordMessage}
              </p>
            )}
            <button
              onClick={handlePasswordChange}
              className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              aria-label="Change Password"
            >
              Change Password
            </button>
          </div>
          {user.isAdmin && (
            <div className="pt-6 border-t border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Manage User Access</h2>
              {isLoading ? (
                <p className="text-white text-center">Loading...</p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Grant View Access</h3>
                    <div className="mb-4">
                      <label className="block text-white text-lg font-medium mb-2">Viewer</label>
                      <input
                        type="text"
                        value={user.username}
                        disabled
                        className="w-full p-3 rounded-lg bg-white/20 text-white border border-white/10"
                        aria-label="Viewer Username (Current User)"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-white text-lg font-medium mb-2" htmlFor="targetUsername">Target User</label>
                      <select
                        id="targetUsername"
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:border-teal-400"
                        aria-label="Select Target User"
                      >
                        <option value="">Select a user</option>
                        {allUsers.length > 0 ? (
                          allUsers.map((username) => (
                            <option key={username} value={username}>
                              {capitalizeFirstLetter(username)}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No users available</option>
                        )}
                      </select>
                    </div>
                    <button
                      onClick={handleGrantAccess}
                      disabled={!targetUsername}
                      className={`w-full p-3 rounded-lg text-white ${
                        targetUsername ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-500 cursor-not-allowed'
                      }`}
                      aria-label="Grant Access"
                    >
                      Grant Access
                    </button>
                    {accessMessage && (
                      <p className={`text-center text-sm mt-2 ${accessMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                        {accessMessage}
                      </p>
                    )}
                  </div>
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-2">Current Access Permissions</h3>
                    {accessList.length === 0 ? (
                      <p className="text-white text-center">No access permissions granted.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-gray-300">
                              <th className="p-3">Viewer</th>
                              <th className="p-3">Target</th>
                              <th className="p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accessList.map((access, index) => (
                              <tr key={index} className="border-t border-white/10">
                                <td className="p-3">{capitalizeFirstLetter(access.viewer)}</td>
                                <td className="p-3">{capitalizeFirstLetter(access.target)}</td>
                                <td className="p-3">
                                  <button
                                    onClick={() => handleRevokeAccess(access.viewer, access.target)}
                                    className="text-red-400 hover:text-red-500"
                                    aria-label={`Revoke access for ${access.viewer} to ${access.target}`}
                                  >
                                    Revoke
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setPage('menu')}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            aria-label="Back to Menu"
          >
            Back to Menu
          </button>
        </div>
      </section>
    </main>
  );
};
