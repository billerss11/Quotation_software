export function createNextQuotationNumber(existingNumbers: string[], date = new Date()) {
  const year = date.getFullYear()
  const nextSequence = getHighestSequenceForYear(existingNumbers, year) + 1

  return `Q-${year}-${String(nextSequence).padStart(3, '0')}`
}

function getHighestSequenceForYear(existingNumbers: string[], year: number) {
  const pattern = new RegExp(`^Q-${year}-(\\d+)$`)

  return existingNumbers.reduce((highest, quotationNumber) => {
    const sequence = quotationNumber.match(pattern)?.[1]

    if (!sequence) {
      return highest
    }

    return Math.max(highest, Number(sequence))
  }, 0)
}
