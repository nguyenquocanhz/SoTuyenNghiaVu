import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { fold } from '@/domain/search';

import { PAGE_SIZE, type PageOrientation } from './html';

/** ASCII file name without spaces, e.g. "Phieu_so_tuyen_Nguyen_Van_A". */
export function safeFileName(title: string): string {
  return fold(title)
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

/**
 * Android's print WebView lays pages out at 72 CSS px per inch (expo-print media size in points),
 * while CSS pt/mm assume 96 px per inch, so forms print 4/3 too large and spill onto a second page.
 * Scaling the body by 72/96 restores true A4 proportions (same result as desktop Chrome).
 */
function forDevice(html: string): string {
  return Platform.OS === 'android' ? html.replace('</head>', '<style>body{zoom:0.75}</style></head>') : html;
}

export async function printHtml(html: string, orientation: PageOrientation = 'portrait'): Promise<void> {
  await Print.printAsync({
    html: forDevice(html),
    ...PAGE_SIZE[orientation],
    orientation: orientation === 'landscape' ? Print.Orientation.landscape : Print.Orientation.portrait,
  });
}

/** Renders to PDF, renames it to a readable name and opens the share sheet (Zalo, Gmail, Drive…). */
export async function sharePdf(html: string, title: string, orientation: PageOrientation = 'portrait'): Promise<void> {
  if (Platform.OS === 'web') {
    await printHtml(html, orientation);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: forDevice(html), ...PAGE_SIZE[orientation] });
  const target = new File(Paths.cache, `${safeFileName(title)}.pdf`);
  if (target.exists) target.delete();
  new File(uri).move(target);
  await share(target.uri, 'application/pdf', title);
}

export async function shareText(content: string, fileName: string, mimeType: string, title: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await share(file.uri, mimeType, title);
}

async function share(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị không hỗ trợ chia sẻ tệp.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}
