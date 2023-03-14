export function buildUrl(url: string, params: Object) {
  const paramString = Object.entries(params)
    .map(([key, value]) => {
      return encodeURIComponent(key) + "=" + encodeURIComponent(value);
    })
    .join("&");
  return url + (url.includes("?") ? "&" : "?") + paramString;
}

export function getUnixTimeStampString(date: Date): string {
  return Math.floor(date.getTime() / 1000).toFixed();
}
