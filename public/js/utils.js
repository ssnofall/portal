// Generate a secure random peer ID
export function generatePeerId(length = 10) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return 'peer_' + Array.from(array, byte => byte.toString(36).padStart(2, '0'))
                         .join('')
                         .substring(0, length);
}
