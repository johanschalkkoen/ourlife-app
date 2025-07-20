const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const getCurrentDateTime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  now.setMinutes(now.getMinutes() - offset);
  return now.toISOString().slice(0, 19);
};

const formatDateTimeWithSeconds = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/,/, '');
};
