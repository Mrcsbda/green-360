// Web: lectura con File API y descarga con Blob. La versión nativa está en fileIO.native.ts.
import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile { name: string; data: ArrayBuffer }

export const PICK_TYPES = [
  '.xlsx', '.csv', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export async function pickSpreadsheet(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (a.file) return { name: a.name, data: await a.file.arrayBuffer() };
  return { name: a.name, data: await (await fetch(a.uri)).arrayBuffer() };
}

export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
