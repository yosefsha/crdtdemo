// this helper function will return a promise that resolves after the specified time
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// this helper function will return a string with the current date and time in the format "YYYY-MM-DDTHH:MM:SS"
export const getCurrentDateTimeString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${
    now.getMonth() + 1
  }-${now.getDate()}T${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
};

// Returns the current time as a string in HH:MM:SS format
export const getCurrentTime = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
