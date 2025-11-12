import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a 32-character hex app key from a serial number using CRC32 hash
 * Converted from C implementation
 */
export function generateAppKey(serialNumber: number): string {
  const hashV = crc32Hash(serialNumber)

  // Convert the 4 uint32 values to a 16-byte array
  const bytes: number[] = []
  for (let i = 0; i < 4; i++) {
    bytes.push((hashV[i] >>> 0) & 0xFF)
    bytes.push((hashV[i] >>> 8) & 0xFF)
    bytes.push((hashV[i] >>> 16) & 0xFF)
    bytes.push((hashV[i] >>> 24) & 0xFF)
  }

  // Convert bytes to hex string
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

/**
 * CRC32 hash function
 * @param polynomial - The polynomial value (serial number)
 * @returns Array of 4 uint32 values
 */
function crc32Hash(polynomial: number): number[] {
  polynomial ^= 0xEDB88325

  const outV: number[] = []

  for (let i = 4; i < 8; i++) {
    let crc = i >>> 0 // Ensure unsigned 32-bit

    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ polynomial) >>> 0 : (crc >>> 1) >>> 0
    }

    outV[i - 4] = crc >>> 0 // Ensure unsigned 32-bit
  }

  return outV
}

/**
 * Generate app key from DevEUI string
 * Extracts the numeric portion from the DevEUI to use as serial number
 */
export function generateAppKeyFromDevEUI(devEui: string): string {
  // Remove any non-hex characters and convert to number
  const cleanDevEui = devEui.replace(/[^0-9A-Fa-f]/g, '')

  // Take last 8 characters (32 bits) as the serial number
  const serialNumber = parseInt(cleanDevEui.slice(-8), 16)

  return generateAppKey(serialNumber)
}
