import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function toDashed(title?: string): string {
  return title ? title.toLowerCase()
    .replace(': ', '-')
    .replace(' - ', '-')
    .replace('--', '-')
    .replace(/[^\w- ]+/g, '')
    .replace(/ +/g, '-') : ''
}

export function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

export function clearAndUpper(text: string): string {
  return text.replace(/-/, "").toUpperCase();
}

export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

export interface RequestResult {
  url?: string
  response?: AxiosResponse
}


export const tryRequests = async (urls: string[], options: AxiosRequestConfig): Promise<RequestResult> => {
  const [url, ...nextUrls] = urls
  let response
  try {
    response = await axios.get(url, options)
    return { url, response }
  } catch (error) {
    if (isRateLimited(error)) {
      throw error
    }
    if (nextUrls.length > 0) {
      try {
        return tryRequests(nextUrls, options)
      } catch (err2) {
        return { url: undefined, response: undefined }
      }
    } else {
      // console.error(err)
      return { url: undefined, response: undefined }
    }
  }
}

export const isRateLimited = (error: unknown): boolean => {
  return !!(error instanceof AxiosError && error.response && [403, 429, 503].includes(error.response.status))
}