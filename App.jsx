const App = () => {
  const [user, setUser] = React.useState(null);
  const [page, setPage] = React.useState('login');

  const handleLogin = (userInfo) => {
    setUser(userInfo);
    setPage('menu');
  };

  const handleLogout = () => {
    setUser(null);
    setPage('login');
  };

  return (
    <ErrorBoundary>
      {user && page !== 'login' && (
        <Navigation user={user} setPage={setPage} onLogout={handleLogout} />
      )}
      {page === 'login' && <Login onLogin={handleLogin} />}
      {page === 'menu' && user && <Menu user={user} setPage={setPage} />}
      {page === 'about' && user && <About setPage={setPage} />}
      {page === 'support' && user && <Support setPage={setPage} />}
      {page === 'contact' && user && <Contact setPage={setPage} />}
      {page === 'budgetCalculator' && user && <BudgetCalculator user={user} setPage={setPage} />}
      {page === 'profileSettings' && user && <ProfileSettings user={user} setPage={setPage} />}
      {page === 'transactions' && user && <Transactions user={user} setPage={setPage} />}
      {page === 'calendar' && user && <Calendar user={user} setPage={setPage} />}
    </ErrorBoundary>
  );
};
