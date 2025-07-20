const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    const errorHandler = (error, errorInfo) => {
      setHasError(true);
      setErrorMessage(error.message);
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    };
    return () => {};
  }, []);

  if (hasError) {
    return (
      <div className="error-boundary">
        <h1>Something went wrong.</h1>
        <p>{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
        >
          Reload Page
        </button>
      </div>
    );
  }
  return children;
};
