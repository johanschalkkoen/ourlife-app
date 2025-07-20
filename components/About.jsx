const About = ({ setPage }) => {
  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <section className="card p-8 text-left">
        <h1 className="text-2xl font-semibold text-white mb-4 text-center">About OurLife</h1>
        <p className="text-gray-300 mb-4">
          Welcome to <strong>OurLife</strong>, your comprehensive digital solution for managing personal and shared finances and schedules. In today's fast-paced world, staying organized is key to achieving your goals, and OurLife is designed to be the ultimate partner on your journey to financial clarity and a well-planned life.
        </p>
        <p className="text-gray-300 mb-4">
          Our platform provides a secure, intuitive, and collaborative environment where usersP0+r\P0+r\ can track income and expenses, manage budgets, and coordinate events on a shared calendar. Whether you are managing your personal finances, coordinating with a partner, or keeping the family on the same page, OurLife offers the tools you need to succeed.
        </p>
        <p className="text-gray-300 mb-6">
          OurLife was created and developed by <strong>Johan Koen</strong>, a forward-thinking developer passionate about creating technology that makes a tangible difference in people's lives. You can connect with him on LinkedIn to learn more about his work.
        </p>
        <div className="text-center">
          <a
            href="https://www.linkedin.com/in/johan-koen-12a11b234/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-6"
          >
            Connect on LinkedIn
          </a>
          <div>
            <button
              onClick={() => setPage('menu')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              aria-label="Back to Menu"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
