import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'

export const hashFile = async (file: string): Promise<string> => {
  try {
    const buffer = await readFile(file)
    const stats = await stat(file)
    const slice = buffer.subarray(0, 4096)
    const u8 = new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength)
    return createHash('sha256').update(u8).update(String(stats.size)).digest('hex').substring(0, 16)
  } catch {
    return '0'
  }
}
