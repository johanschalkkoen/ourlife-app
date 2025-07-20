const Login = ({ onLogin }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('https://ourlife.work.gd:8443/api/login', { username, password }, { timeout: 5000 });
      if (response.data.success) {
        const userInfo = {
          username,
          profilePicUrl: response.data.profilePicUrl || DEFAULT_PROFILE_PIC_URL,
          email: response.data.email || '',
          phone: response.data.phone || '',
          address: response.data.address || '',
          eventColor: response.data.eventColor || DEFAULT_EVENT_COLOR,
          isAdmin: response.data.isAdmin || false
        };
        onLogin(userInfo);
      } else {
        setError(response.data.message || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error during login. Check server.');
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <section className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">Sign In</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
            aria-label="Username"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400"
            aria-label="Password"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            aria-label="Sign In"
          >
            Sign In
          </button>
        </form>
      </section>
    </main>
  );
};
