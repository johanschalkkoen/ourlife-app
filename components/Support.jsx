const Support = ({ setPage }) => {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ name, email, message });
    setSubmitted(true);
  };

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">Support & FAQ</h1>
        <div className="space-y-4 mb-8 text-left">
          <div>
            <h3 className="font-semibold text-lg text-teal-400">How do I add a transaction item?</h3>
            <p className="text-gray-300">Navigate to the "Transactions" page and use the "Add Item" button to open the form. Fill in the financial description and other details, then click "Add Item" to save it. The item will also automatically appear on your calendar.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-teal-400">Can I share my data with another user?</h3>
            <p className="text-gray-300">Yes, if you have admin privileges. Go to "Profile Settings" and use the "Manage User Access" section to grant another user view access to your transaction and calendar data.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-teal-400">How do I change my password?</h3>
            <p className="text-gray-300">In "Profile Settings", you'll find a "Change Password" section. You'll need to enter your current password and a new password to update it.</p>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold text-white mb-4 text-center">Submit a Support Ticket</h2>
          {submitted ? (
            <p className="text-green-400 text-center">Thank you! Your request has been submitted.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required />
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue..." rows="4" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required></textarea>
              <button type="submit" className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600">Submit</button>
            </form>
          )}
        </div>
        <div className="text-center mt-8">
          <button onClick={() => setPage('menu')} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Back to Menu</button>
        </div>
      </section>
    </main>
  );
};
