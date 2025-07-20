const Navigation = ({ user, setPage, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const handleNavClick = (page) => {
    setPage(page);
    setIsMenuOpen(false);
  };
  const handleKeyDown = (e, page) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleNavClick(page);
    }
  };
  return (
    <nav className="sticky-header p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="https://placehold.co/32x32/808080/FFFFFF?text=OL" alt="OurLife Logo" className="w-8 h-8" />
        <h1 className="text-xl font-semibold text-white">OurLife Dashboard</h1>
      </div>
      <button
        className="hamburger-menu md:hidden text-white focus:outline-none"
        onClick={toggleMenu}
        tabIndex={0}
        aria-label="Toggle navigation menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>
      <div className={`nav-links flex-col md:flex-row md:flex space-x-0 md:space-x-2 ${isMenuOpen ? 'open' : ''}`}>
        <button onClick={() => handleNavClick('menu')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Home</button>
        <button onClick={() => handleNavClick('transactions')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Transactions</button>
        <button onClick={() => handleNavClick('calendar')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Calendar</button>
        <button onClick={() => handleNavClick('profileSettings')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Profile</button>
        <button onClick={() => handleNavClick('budgetCalculator')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Budget</button>
        <button onClick={() => handleNavClick('about')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">About</button>
        <button onClick={() => handleNavClick('support')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Support</button>
        <button onClick={() => handleNavClick('contact')} className="px-3 py-2 text-white hover:bg-teal-500 rounded-lg w-full text-left md:w-auto">Contact</button>
        <button onClick={onLogout} className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 w-full text-left md:w-auto">Sign Out</button>
      </div>
    </nav>
  );
};
