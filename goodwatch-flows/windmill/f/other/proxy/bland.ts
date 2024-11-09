import * as wmill from "windmill-client"


export async function main(path: string, method: 'GET' | 'POST' | 'DELETE', body?: Record<string, string>) {
  if (!['GET', 'POST', 'DELETE'].includes(method)) throw Error(`Invalid method: ${method}`)

  const token = await wmill.getVariable('u/Alp/BLAND_TOKEN')
  const options = {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(`https://api.bland.ai${path}`, options)
  return response.json();
}
