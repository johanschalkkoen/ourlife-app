const BudgetCalculator = ({ user, setPage }) => {
  const [summary, setSummary] = React.useState({ income: 0, expense: 0, balance: 0 });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [currentMonth] = React.useState(new Date().toISOString().slice(0, 7));

  React.useEffect(() => {
    const fetchTransactionData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.get('https://ourlife.work.gd:8443/api/transactions', {
          params: { user: user.username },
          timeout: 5000
        });
        const userItems = response.data.filter(item =>
          item.user === user.username && item.date.startsWith(currentMonth)
        );
        const income = userItems
          .filter(item => item.type === 'income')
          .reduce((sum, item) => sum + item.amount, 0);
        const expense = userItems
          .filter(item => item.type === 'expense')
          .reduce((sum, item) => sum + item.amount, 0);
        setSummary({ income, expense, balance: income - expense });
      } catch (err) {
        setError('Failed to load transaction data.');
        console.error('Error fetching transaction data for budget:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactionData();
  }, [user.username, currentMonth]);

  const expensePercentage = summary.income > 0 ? (summary.expense / summary.income) * 100 : 0;

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8">
        <h1 className="text-2xl font-semibold text-white mb-6">Monthly Budget Calculator</h1>
        {isLoading ? (
          <p className="text-white text-center">Calculating...</p>
        ) : error ? (
          <p className="text-red-400 text-center">{error}</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-white mb-2">Summary for {new Date(currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
              <div className="card p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-green-400 font-semibold">Total Income:</span>
                  <span className="text-green-400">R{summary.income.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-400 font-semibold">Total Expenses:</span>
                  <span className="text-red-400">R{summary.expense.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 my-2"></div>
                <div className="flex justify-between items-center font-bold text-xl">
                  <span className="text-white">Net Balance:</span>
                  <span className={summary.balance >= 0 ? 'text-teal-400' : 'text-orange-400'}>
                    R{summary.balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-medium text-white mb-2">Expense Breakdown</h2>
              <div className="w-full bg-gray-700 rounded-full h-6">
                <div
                  className="bg-red-500 h-6 rounded-full text-center text-white text-sm flex items-center justify-center"
                  style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                >
                  {expensePercentage > 5 ? `${expensePercentage.toFixed(0)}%` : ''}
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2 text-center">
                You have spent {expensePercentage.toFixed(0)}% of your income.
              </p>
            </div>
            <button
              onClick={() => setPage('menu')}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              aria-label="Back to Menu"
            >
              Back to Menu
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
