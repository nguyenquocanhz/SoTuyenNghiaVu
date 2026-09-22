/// <reference types="jest" />
import { getProtocol, identifyByServices, identifyDevice, PROTOCOLS } from '@/ble/protocols';
import type { AdvertisementPacket } from '@/ble/types';
import { fullUuid, sameUuid, UUID } from '@/ble/uuids';

const adv = (partial: Partial<AdvertisementPacket>): AdvertisementPacket => ({
  id: 'AA:BB:CC:DD:EE:FF',
  name: null,
  rssi: -60,
  serviceUUIDs: [],
  serviceData: {},
  manufacturerData: null,
  receivedAt: 0,
  ...partial,
});

const bytes = (n: number, fill = 0x22) => new Uint8Array(n).fill(fill);

describe('uuids', () => {
  it('expands short SIG UUIDs to lower-case 128-bit form', () => {
    expect(fullUuid(0x181d)).toBe('0000181d-0000-1000-8000-00805f9b34fb');
    expect(fullUuid('181D')).toBe('0000181d-0000-1000-8000-00805f9b34fb');
    expect(fullUuid('0x2A9C')).toBe('00002a9c-0000-1000-8000-00805f9b34fb');
    expect(fullUuid('0000181B')).toBe('0000181b-0000-1000-8000-00805f9b34fb');
    expect(fullUuid('0000181D-0000-1000-8000-00805F9B34FB')).toBe(UUID.weightScaleService);
    expect(sameUuid('1809', UUID.healthThermometerService)).toBe(true);
    expect(sameUuid('1809', 0x181d)).toBe(false);
  });
});

describe('identifyDevice', () => {
  it('prefers Xiaomi v1 service data over the generic 0x181D service UUID', () => {
    const m = identifyDevice(adv({ serviceUUIDs: [UUID.weightScaleService], serviceData: { [UUID.weightScaleService]: bytes(10) } }));
    expect(m).toEqual({ protocolId: 'xiaomi_v1', protocolName: 'Xiaomi Mi Smart Scale', kind: 'scale', transport: 'advertisement' });
  });

  it('recognises Xiaomi v2 from 13-byte 0x181B service data', () => {
    const m = identifyDevice(adv({ serviceUUIDs: [UUID.bodyCompositionService], serviceData: { [UUID.bodyCompositionService]: bytes(13) } }));
    expect(m?.protocolId).toBe('xiaomi_v2');
    expect(m?.transport).toBe('advertisement');
  });

  it('falls back to the SIG GATT scale when service data has another length', () => {
    const m = identifyDevice(adv({ serviceUUIDs: [UUID.weightScaleService], serviceData: { [UUID.weightScaleService]: bytes(7) } }));
    expect(m?.protocolId).toBe('sig_scale');
  });

  it('identifies SIG scales from advertised service UUIDs', () => {
    expect(identifyDevice(adv({ serviceUUIDs: [UUID.weightScaleService] }))).toEqual({
      protocolId: 'sig_scale',
      protocolName: 'Bluetooth SIG Weight Scale / Body Composition',
      kind: 'scale',
      transport: 'gatt',
    });
    expect(identifyDevice(adv({ serviceUUIDs: [UUID.bodyCompositionService] }))?.protocolId).toBe('sig_scale');
  });

  it('identifies SIG thermometers from 0x1809', () => {
    expect(identifyDevice(adv({ serviceUUIDs: [UUID.healthThermometerService] }))).toEqual({
      protocolId: 'sig_thermometer',
      protocolName: 'Bluetooth SIG Health Thermometer',
      kind: 'thermometer',
      transport: 'gatt',
    });
  });

  it('checks broadcast formats before GATT services', () => {
    const qn = Uint8Array.from([0xff, 0xff, 0xaa, 0xbb, ...new Array(13).fill(0), 0x20, 0, 0x8a, 0x1b]);
    expect(identifyDevice(adv({ manufacturerData: qn, serviceUUIDs: [UUID.weightScaleService] }))?.protocolId).toBe('qn_broadcast');
    expect(identifyDevice(adv({ name: 'Chipsea-BLE', serviceUUIDs: [UUID.weightScaleService] }))?.protocolId).toBe('okok');
  });

  it('identifies OKOK scales by name', () => {
    expect(identifyDevice(adv({ name: 'ADV' }))).toEqual({ protocolId: 'okok', protocolName: 'OKOK / Chipsea', kind: 'scale', transport: 'advertisement' });
  });

  it('returns null for unknown devices', () => {
    expect(identifyDevice(adv({}))).toBeNull();
    expect(identifyDevice(adv({ name: 'Galaxy Watch', serviceUUIDs: [fullUuid(0x180f)] }))).toBeNull();
  });
});

describe('identifyByServices', () => {
  it('maps discovered GATT services to SIG protocols', () => {
    expect(identifyByServices([fullUuid(0x1800), UUID.weightScaleService])?.protocolId).toBe('sig_scale');
    expect(identifyByServices([UUID.bodyCompositionService])?.protocolId).toBe('sig_scale');
    expect(identifyByServices([UUID.healthThermometerService])).toEqual({
      protocolId: 'sig_thermometer',
      protocolName: 'Bluetooth SIG Health Thermometer',
      kind: 'thermometer',
      transport: 'gatt',
    });
  });

  it('prefers the scale when both profiles are present', () => {
    expect(identifyByServices([UUID.healthThermometerService, UUID.weightScaleService])?.protocolId).toBe('sig_scale');
  });

  it('returns null without a known service', () => {
    expect(identifyByServices([])).toBeNull();
    expect(identifyByServices([fullUuid(0x180f), fullUuid(0x180a)])).toBeNull();
  });
});

describe('protocol registry', () => {
  it('has unique ids and lists broadcast protocols first', () => {
    const ids = PROTOCOLS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['xiaomi_v2', 'xiaomi_v1', 'okok', 'qn_broadcast', 'sig_scale', 'sig_thermometer']);
    const firstGatt = PROTOCOLS.findIndex((p) => p.transport === 'gatt');
    expect(PROTOCOLS.slice(firstGatt).every((p) => p.transport === 'gatt')).toBe(true);
  });

  it('looks protocols up by id', () => {
    expect(getProtocol('okok')?.name).toBe('OKOK / Chipsea');
    expect(getProtocol('sig_thermometer')?.kind).toBe('thermometer');
    expect(getProtocol('nope')).toBeUndefined();
  });
});
