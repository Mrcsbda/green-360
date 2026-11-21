import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PickedFile { name: string; data: ArrayBuffer }
export const PICK_TYPES = ['*/*'];

export async function pickSpreadsheet(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { name: a.name, data: await new File(a.uri).arrayBuffer() };
}

export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir archivos no está disponible en este dispositivo');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: `Exportar ${name}` });
}
