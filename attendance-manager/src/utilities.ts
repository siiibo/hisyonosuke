export type valueOf<T> = T[keyof T];

type URIEncodable = {
  [Key: string]: string | number | boolean;
};

export function buildUrl(url: string, params: URIEncodable) {
  const paramString = Object.entries(params)
    .map(([key, value]) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
  return url + (url.includes("?") ? "&" : "?") + paramString;
}

export function getUnixTimeStampString(date: Date): string {
  return Math.floor(date.getTime() / 1000).toString();
}
