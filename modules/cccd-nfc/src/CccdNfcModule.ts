import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { CccdNfcModuleEvents } from './CccdNfc.types';

/** Raw native surface (Android). Values are normalised in ../index.ts. */
export declare class CccdNfcNativeModule extends NativeModule<CccdNfcModuleEvents> {
  getNfcStatus(): { supported: boolean; enabled: boolean };
  openNfcSettings(): boolean;
  readCard(idNumber: string, dateOfBirth: string, dateOfExpiry: string): Promise<Record<string, unknown>>;
  cancel(): void;
}

/** null on iOS / web or when the native app was built without the module. */
export default requireOptionalNativeModule<CccdNfcNativeModule>('CccdNfc');
