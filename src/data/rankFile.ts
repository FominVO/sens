export type RankFile = {
  vocabSize: number;
  secretIndex: number;
  ranks: Uint16Array;
};

export function parseRankFile(buffer: ArrayBuffer): RankFile {
  if (buffer.byteLength < 8) throw new Error("Порожній файл рангів");
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "SEN1") throw new Error("Невідомий формат рангів");
  const vocabSize = view.getUint16(4, true);
  const secretIndex = view.getUint16(6, true);
  if (8 + vocabSize * 2 !== buffer.byteLength) throw new Error("Файл рангів пошкоджено");
  const ranks = new Uint16Array(vocabSize);
  for (let i = 0; i < vocabSize; i += 1) ranks[i] = view.getUint16(8 + i * 2, true);
  return { vocabSize, secretIndex, ranks };
}

export function parseForms(buffer: ArrayBuffer): Map<string, number> {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "FRM1") throw new Error("Невідомий формат словника");
  const count = view.getUint32(4, true);
  const forms = new Map<string, number>();
  const bytes = new Uint8Array(buffer);
  let offset = 8;
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i += 1) {
    const index = view.getUint16(offset, true);
    const length = view.getUint8(offset + 2);
    offset += 3;
    const key = decoder.decode(bytes.subarray(offset, offset + length));
    offset += length;
    forms.set(key, index);
  }
  return forms;
}
