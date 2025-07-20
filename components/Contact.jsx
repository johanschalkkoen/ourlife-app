const Contact = ({ setPage }) => {
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
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">Contact Us</h1>
        <div className="grid md:grid-cols-2 gap-8 mb-8 text-left">
          <div>
            <h3 className="font-semibold text-lg text-teal-400 mb-2">Get in Touch</h3>
            <p className="text-gray-300">Have a question, feedback, or a business inquiry? We'd love to hear from you. Use the form or contact us directly.</p>
            <div className="mt-4 space-y-2">
              <p className="text-gray-300"><strong>Email:</strong> support@ourlife.work.gd</p>
              <p className="text-gray-300"><strong>Phone:</strong> +27 (11) 555-0123</p>
              <p className="text-gray-300"><strong>Location:</strong> Alberton, Gauteng, South Africa</p>
            </div>
          </div>
          <div>
            {submitted ? (
              <p className="text-green-400 text-center md:text-left">Thank you for your message! We'll get back to you shortly.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required />
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Your Message..." rows="4" className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:border-teal-400" required></textarea>
                <button type="submit" className="w-full p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600">Send Message</button>
              </form>
            )}
          </div>
        </div>
        <div className="text-center mt-8">
          <button onClick={() => setPage('menu')} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Back to Menu</button>
        </div>
      </section>
    </main>
  );
};
