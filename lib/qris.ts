/**
 * CRC-16/CCITT-FALSE algorithm
 * Used for QRIS checksum calculation
 */
function calculateCRC16(data: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
      crc &= 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

type TLVField = {
  tag: string
  value: string
}

function encodeTLV(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, '0')}${value}`
}

function parseTLV(payload: string): TLVField[] {
  const fields: TLVField[] = []
  let cursor = 0

  while (cursor < payload.length) {
    const tag = payload.slice(cursor, cursor + 2)
    const length = Number(payload.slice(cursor + 2, cursor + 4))

    if (!tag || Number.isNaN(length)) {
      throw new Error('Format QRIS tidak valid')
    }

    const valueStart = cursor + 4
    const valueEnd = valueStart + length
    const value = payload.slice(valueStart, valueEnd)

    if (value.length !== length) {
      throw new Error('Panjang field QRIS tidak sesuai')
    }

    fields.push({ tag, value })
    cursor = valueEnd
  }

  return fields
}

/**
 * Mengubah QRIS statis menjadi QRIS dinamis dengan menyisipkan/memperbarui Tag 54 (Transaction Amount)
 *
 * Format Tag 54: '54' + dua digit panjang + nominal
 * Contoh: nominal 50000 → '540550000'
 *
 * @param staticQRIS - String QRIS statis (tanpa Tag 54)
 * @param amount - Nominal transaksi dalam Rupiah
 * @returns String QRIS dinamis lengkap dengan CRC baru
 */
export function generateDynamicQRIS(staticQRIS: string, amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Nominal QRIS harus bilangan bulat positif')
  }

  const normalizedQRIS = staticQRIS
    .replace(/[\r\n\t]+/g, '')
    .trim()
  const crcTagIndex = normalizedQRIS.lastIndexOf('6304')
  const qrisWithoutCRC = crcTagIndex >= 0 ? normalizedQRIS.slice(0, crcTagIndex) : normalizedQRIS
  const fields = parseTLV(qrisWithoutCRC)
  const amountField: TLVField = { tag: '54', value: amount.toString() }

  const rebuiltFields: TLVField[] = []
  let insertedAmount = false

  for (const field of fields) {
    if (field.tag === '63') {
      continue
    }

    if (field.tag === '54') {
      continue
    }

    if (!insertedAmount && field.tag === '58') {
      rebuiltFields.push(amountField)
      insertedAmount = true
    }

    if (field.tag === '01') {
      rebuiltFields.push({ tag: '01', value: '12' })
      continue
    }

    rebuiltFields.push(field)
  }

  if (!insertedAmount) {
    rebuiltFields.push(amountField)
  }

  const payload = rebuiltFields.map(field => encodeTLV(field.tag, field.value)).join('')
  const payloadForCRC = `${payload}6304`
  const crc = calculateCRC16(payloadForCRC)

  return `${payloadForCRC}${crc}`
}
