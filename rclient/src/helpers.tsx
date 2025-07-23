// a function that waits for a given amount of time
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to get a timestamp in HH:MM:SS.mmm format
export function getTimestamp(): string {
  const now = new Date();
  return (
    now.toTimeString().split(" ")[0] +
    "." +
    now.getMilliseconds().toString().padStart(3, "0")
  );
}
