import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

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
  } catch (err) {
    if (nextUrls.length > 0) {
      return tryRequests(nextUrls, options)
    } else {
      // console.error(err)
      return { url: undefined, response: undefined }
    }
  }
}