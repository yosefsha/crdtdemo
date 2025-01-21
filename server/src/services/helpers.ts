// this helper function will return a promise that resolves after the specified time
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// this helper function will return a string with the current date and time in the format "YYYY-MM-DDTHH:MM:SS"
export const getCurrentDateTimeString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${
    now.getMonth() + 1
  }-${now.getDate()}T${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
};
