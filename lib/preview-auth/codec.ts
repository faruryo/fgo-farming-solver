export const asBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes)

const stripPadding = (value: string): string => {
  let end = value.length
  while (end > 0 && value.charCodeAt(end - 1) === 61) end -= 1
  return value.slice(0, end)
}

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return stripPadding(btoa(binary).replaceAll('+', '-').replaceAll('/', '_'))
}

export const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return asBytes(Uint8Array.from(atob(padded + pad), (char) => char.charCodeAt(0)))
}

export const utf8 = (value: string): Uint8Array<ArrayBuffer> =>
  asBytes(new TextEncoder().encode(value))

export const randomToken = (bytes = 32): string => {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return bytesToBase64Url(buffer)
}
