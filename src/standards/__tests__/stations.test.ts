/// <reference types="jest" />
import { PROVINCES } from '../adminUnits';
import { communeFullName, findCommune, findProvince, looksLikePersonName, parentUnitName, provinceFullName, stationName } from '../stations';

describe('danh mục đơn vị hành chính từ 01/7/2025', () => {
  it('has 34 provinces with unique codes (loại tỉnh/thành phố theo danh mục hiện hành)', () => {
    expect(PROVINCES).toHaveLength(34);
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(34);
    // The 6 centrally-run cities of 01/7/2025 remain cities.
    for (const name of ['Hà Nội', 'Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ', 'Huế']) {
      expect(PROVINCES.find((p) => p.name === name)?.type).toBe('thành phố');
    }
  });

  it('has 3,321 commune-level units with unique 5-digit codes', () => {
    const communes = PROVINCES.flatMap((p) => p.communes);
    expect(communes).toHaveLength(3321);
    expect(new Set(communes.map((c) => c.code)).size).toBe(communes.length);
    expect(communes.every((c) => /^\d{5}$/.test(c.code))).toBe(true);
    expect(communes.filter((c) => c.type === 'đặc khu')).toHaveLength(13);
  });

  it('keeps names without the type prefix, NFC-normalised', () => {
    for (const p of PROVINCES) {
      expect(p.name).toBe(p.name.normalize('NFC'));
      expect(p.name).not.toMatch(/^(Tỉnh|Thành phố) /);
      for (const c of p.communes) expect(c.name).not.toMatch(/^(Xã|Phường|Đặc khu) /);
    }
  });
});

describe('station naming', () => {
  const hanoi = PROVINCES.find((p) => p.name === 'Hà Nội')!;

  it('builds the station and parent unit names from a commune', () => {
    const c = hanoi.communes.find((x) => x.name === 'Ba Đình')!;
    expect(provinceFullName(hanoi)).toBe('Thành phố Hà Nội');
    expect(communeFullName(c)).toBe('phường Ba Đình');
    expect(stationName(c)).toBe('Trạm Y tế phường Ba Đình');
    expect(parentUnitName(c)).toBe('UBND phường Ba Đình');
    expect(findCommune(hanoi.code, c.code)).toBe(c);
    expect(findProvince(hanoi.code)).toBe(hanoi);
    expect(findCommune(hanoi.code, '00000')).toBeUndefined();
  });
});

describe('looksLikePersonName', () => {
  it.each([
    ['Nguyễn Thị Hoa', true],
    ['NGUYỄN VĂN AN', true],
    ['Phiếu sơ tuyển', false],
    ['DEMO', false],
    ['Trạm Y tế xã An Bình', false],
    ['Hoa', false],
    ['Nguyễn Văn 2', false],
  ])('%s → %s', (value, expected) => {
    expect(looksLikePersonName(value)).toBe(expected);
  });
});
