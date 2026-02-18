export interface TextChunk {
  chunkIndex: number
  chunkText: string
}

/**
 * Split text into overlapping chunks on sentence boundaries.
 */
export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): TextChunk[] {
  const { chunkSize = 500, overlap = 100 } = options

  if (!text || text.trim().length === 0) return []

  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 0)

  const chunks: TextChunk[] = []
  let current = ""
  let chunkIndex = 0

  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push({ chunkIndex, chunkText: current.trim() })
      chunkIndex++

      // Keep overlap from end of current chunk
      if (overlap > 0) {
        const words = current.split(/\s+/)
        const overlapWords: string[] = []
        let overlapLen = 0
        for (let i = words.length - 1; i >= 0 && overlapLen < overlap; i--) {
          overlapWords.unshift(words[i])
          overlapLen += words[i].length + 1
        }
        current = overlapWords.join(" ") + " " + sentence
      } else {
        current = sentence
      }
    } else {
      current = current ? current + " " + sentence : sentence
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ chunkIndex, chunkText: current.trim() })
  }

  return chunks
}
