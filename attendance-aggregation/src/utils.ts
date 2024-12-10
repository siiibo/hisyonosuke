export const getUnixTimeStampString = (date: Date): string => {
  return Math.floor(date.getTime() / 1000).toFixed();
};

export const getDateFromUnixTimeStampString = (unixTimeStampString: string) => {
  return new Date(Number.parseInt(unixTimeStampString) * 1000);
};
