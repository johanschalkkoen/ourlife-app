const Menu = ({ user, setPage }) => {
  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center flex items-center justify-center gap-3">
          <div className="profile-pic-container welcome-pic-container">
            <img src={user.profilePicUrl || DEFAULT_PROFILE_PIC_URL} alt={`${user.username}'s profile`} className="profile-pic" />
          </div>
          <span>Welcome, {capitalizeFirstLetter(user.username)}!</span>
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <button onClick={() => setPage('transactions')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">Transactions</button>
          <button onClick={() => setPage('calendar')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">Calendar</button>
          <button onClick={() => setPage('profileSettings')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">Profile</button>
          <button onClick={() => setPage('budgetCalculator')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">Budget</button>
          <button onClick={() => setPage('about')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">About</button>
          <button onClick={() => setPage('support')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center">Support</button>
          <button onClick={() => setPage('contact')} className="p-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-center sm:col-start-2 md:col-start-auto">Contact</button>
        </div>
      </section>
    </main>
  );
};
