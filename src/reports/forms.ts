import { formatNumber, isoToViDate, isValidIsoDate } from '@/domain/format';
import { recordMeasurement } from '@/domain/physique';
import { healthStatusText } from '@/domain/screening';
import { recordedBloodPressure } from '@/domain/vitals';
import type { Campaign, Citizen, Screening } from '@/domain/types';
import { exemptDisease } from '@/standards/exemptions';
import type { Settings } from '@/store/settings';

import { blankDateLine, dateLine, esc, fill, htmlDocument, nationalHeader } from './html';

type Unit = Pick<Settings, 'parentUnit' | 'unitName' | 'placeName' | 'teamLeader'>;

const viDate = (iso?: string) => (iso && isValidIsoDate(iso) ? isoToViDate(iso) : '');
const whole = (v?: number) => (v !== undefined ? formatNumber(recordMeasurement(v), 0) : '');
const acuity = (v?: number) => (v !== undefined ? `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}/10` : '');
const diopter = (v?: number) => (v !== undefined ? `${v > 0 ? '+' : ''}${formatNumber(v, Number.isInteger(v) ? 0 : 2)}` : '');
const sexText = (c: Citizen) => (c.sex === 'male' ? 'Nam' : 'Nữ');
const dateOf = (iso?: string) => (iso && isValidIsoDate(iso) ? new Date(`${iso}T00:00:00`) : undefined);

/** Mẫu 2 Phụ lục I Thông tư 106/2025/TT-BQP – Phiếu sơ tuyển sức khỏe nghĩa vụ quân sự. */
export function screeningFormPage(unit: Unit, citizen: Citizen, s: Screening | undefined): string {
  const v = s?.vision ?? {};
  const bp = s ? recordedBloodPressure(s) : undefined;
  const opinion = s?.teamOpinion?.trim();
  const opinionLines = opinion
    ? `<div class="line">${esc(opinion).replace(/\n/g, '<br>')}</div>`
    : Array.from({ length: 5 }, () => '<div class="line"><span class="dots" style="width:100%"></span></div>').join('');
  return `<div class="page">
    ${nationalHeader(unit)}
    <h1>Phiếu sơ tuyển sức khỏe nghĩa vụ quân sự</h1>
    <h2>I. SƠ YẾU LÝ LỊCH</h2>
    <div class="line">Họ và tên*: ${fill(citizen.fullName, 24)}&nbsp; Ngày, tháng, năm sinh*: ${fill(viDate(citizen.birthDate), 10)}&nbsp; Giới tính: ${fill(sexText(citizen), 4)}</div>
    <div class="line">Số CCCD*: ${fill(citizen.cccd, 14)}&nbsp; Nghề nghiệp: ${fill(citizen.occupation, 14)}&nbsp; Dân tộc: ${fill(citizen.ethnicity, 8)}</div>
    <div class="line">Đã phục vụ tại ngũ*: Từ <i>(tháng/năm)</i> ${fill(citizen.servedFrom, 8)} đến <i>(tháng/năm)</i> ${fill(citizen.servedTo, 8)}</div>
    <div class="line">Họ và tên bố: ${fill(citizen.fatherName, 30)}&nbsp; Năm sinh: ${fill(citizen.fatherBirthYear, 6)}</div>
    <div class="line">Họ và tên mẹ: ${fill(citizen.motherName, 30)}&nbsp; Năm sinh: ${fill(citizen.motherBirthYear, 6)}</div>
    <div class="line">Nơi đăng ký thường trú: ${fill(citizen.permanentAddress, 50)}</div>
    <div class="line">Chỗ ở hiện nay của gia đình: ${fill(citizen.currentAddress, 46)}</div>
    <h2>II. KẾT QUẢ SƠ TUYỂN SỨC KHỎE</h2>
    <div class="line">Cao: ${fill(whole(s?.heightCm), 5)} cm; Nặng: ${fill(whole(s?.weightKg), 5)} kg; Vòng ngực trung bình: ${fill(whole(s?.chestCm), 5)} cm.</div>
    <div class="line">Mạch: ${fill(s?.pulse, 5)} lần/phút; Huyết áp: ${fill(bp?.systolic, 4)}/${fill(bp?.diastolic, 4)} mmHg.</div>
    <div class="line">Thị lực:</div>
    <div class="line">&nbsp;&nbsp;Không kính: Mắt phải: ${fill(acuity(v.rightUncorrected), 6)}; Mắt trái: ${fill(acuity(v.leftUncorrected), 6)}</div>
    <div class="line">&nbsp;&nbsp;Có kính: Mắt phải: ${fill(acuity(v.rightCorrected), 6)} (${fill(diopter(v.rightDiopter), 4)}D); Mắt trái: ${fill(acuity(v.leftCorrected), 6)} (${fill(diopter(v.leftDiopter), 4)}D)</div>
    <div class="line">Tình trạng sức khỏe và bệnh tật: ${fill(s ? healthStatusText(citizen, s) : '', 40)}</div>
    <div class="line">Tiền sử bệnh tật:</div>
    <div class="line">&nbsp;&nbsp;Gia đình: ${fill(s?.familyHistory, 50)}</div>
    <div class="line">&nbsp;&nbsp;Bản thân: ${fill(s?.personalHistory, 50)}</div>
    <h2>III. Ý KIẾN TỔ SƠ TUYỂN</h2>
    ${opinionLines}
    <table class="sign"><tr><td></td><td>
      <div class="italic">${blankDateLine(dateOf(s?.screenedOn))}</div>
      <div><b>TỔ TRƯỞNG</b></div><div><b>TỔ SƠ TUYỂN SỨC KHỎE</b></div>
      <div class="name">${esc(unit.teamLeader)}</div>
    </td></tr></table>
  </div>`;
}

export function screeningFormsHtml(unit: Unit, items: { citizen: Citizen; screening?: Screening }[]): string {
  return htmlDocument(
    'Phiếu sơ tuyển sức khỏe NVQS',
    items.map((i) => screeningFormPage(unit, i.citizen, i.screening)).join(''),
    '.line { text-align: left; } h2 { text-transform: none; }',
  );
}

export interface CampaignStats {
  planned?: number;
  screened: number;
  eligible: number;
  exempt: number;
  other: number;
  pending: number;
  otherReasons: { reason: string; count: number }[];
}

export function campaignStats(campaign: Campaign, screenings: Screening[]): CampaignStats {
  const list = screenings.filter((s) => s.campaignId === campaign.id);
  const reasons = new Map<string, number>();
  for (const s of list.filter((x) => x.outcome === 'other')) {
    const r = otherReasonGroup(s);
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  return {
    planned: campaign.plannedCount,
    screened: list.filter((s) => s.outcome !== 'pending').length,
    eligible: list.filter((s) => s.outcome === 'eligible').length,
    exempt: list.filter((s) => s.outcome === 'exempt').length,
    other: list.filter((s) => s.outcome === 'other').length,
    pending: list.filter((s) => s.outcome === 'pending').length,
    otherReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

/** Groups "lý do khác" for the free rows of Mẫu 2a by the first (main) reason. */
export function otherReasonGroup(s: Screening): string {
  const first = (s.outcomeReason ?? '').split(';')[0].trim().toLowerCase();
  if (first.startsWith('thể lực')) return 'Không đạt tiêu chuẩn thể lực';
  if (first.startsWith('thị lực')) return 'Thị lực, tật khúc xạ';
  if (first.startsWith('huyết áp') || first.startsWith('mạch')) return 'Huyết áp, mạch';
  if (s.findings.some((f) => f.score > 3)) return 'Bệnh, tật, dị tật, dị dạng';
  return 'Lý do khác';
}

/** Mẫu 2a Phụ lục II Thông tư 106/2025/TT-BQP – Báo cáo kết quả sơ tuyển sức khỏe NVQS. */
export function report2aHtml(unit: Unit, campaign: Campaign, stats: CampaignStats, reportDate: Date, recipients: string): string {
  const reasonRows = stats.otherReasons.map((r) => `<tr><td></td><td>&nbsp;&nbsp;+ ${esc(r.reason)}</td><td class="num">${r.count}</td><td></td></tr>`).join('');
  const blanks = Math.max(0, 3 - stats.otherReasons.length);
  const body = `<div class="page">
    ${nationalHeader(unit, `<div class="italic" style="margin-top:4pt">${dateLine(unit.placeName, reportDate)}</div>`, '<div style="margin-top:4pt">Số: ....../......</div>')}
    <h1 style="margin-top:18pt">Báo cáo</h1>
    <p class="sub">Kết quả sơ tuyển sức khỏe nghĩa vụ quân sự</p>
    <p class="sub">Năm ${campaign.year}</p>
    <br>
    <table class="grid">
      <tr><th style="width:8%">TT</th><th>Nội dung</th><th style="width:16%">Kết quả</th><th style="width:22%">Ghi chú</th></tr>
      <tr><td class="num">1</td><td>Số lượng sơ tuyển sức khỏe theo kế hoạch</td><td class="num">${stats.planned ?? ''}</td><td></td></tr>
      <tr><td class="num">2</td><td>Số lượng đã sơ tuyển</td><td class="num">${stats.screened}</td><td class="small">${stats.pending ? `Còn ${stats.pending} công dân chưa kết luận` : ''}</td></tr>
      <tr><td class="num">3</td><td>Số lượng đủ điều kiện khám tại tuyến huyện</td><td class="num">${stats.eligible}</td><td class="small">Chuyển Hội đồng khám sức khỏe khu vực</td></tr>
      <tr><td class="num">4</td><td>Tổng số đã loại ra</td><td class="num">${stats.exempt + stats.other}</td><td></td></tr>
      <tr><td></td><td>Trong đó:</td><td></td><td></td></tr>
      <tr><td></td><td>- Số lượng đề nghị miễn thực hiện NVQS</td><td class="num">${stats.exempt}</td><td></td></tr>
      <tr><td></td><td>- Lý do khác</td><td class="num">${stats.other}</td><td></td></tr>
      ${reasonRows}
      ${'<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'.repeat(blanks)}
    </table>
    <table class="sign"><tr>
      <td style="text-align:left" class="small"><b><i>Nơi nhận:</i></b><br>${esc(recipients).split('\n').map((l) => `- ${l}`).join('<br>')}<br>- Lưu: ......</td>
      <td><div><b>TỔ TRƯỞNG</b></div><div><b>TỔ SƠ TUYỂN SỨC KHỎE</b></div><div class="italic">(Ký tên, ghi rõ họ tên)</div><div class="name">${esc(unit.teamLeader)}</div></td>
    </tr></table>
  </div>`;
  return htmlDocument(`Báo cáo kết quả sơ tuyển NVQS năm ${campaign.year}`, body);
}

export interface BookRow {
  citizen: Citizen;
  screening: Screening;
}

const addressOf = (c: Citizen) => c.currentAddress || c.permanentAddress || '';

/** Mẫu 2k Phụ lục II Thông tư 106/2025/TT-BQP – Sổ thống kê sơ tuyển sức khỏe NVQS (cho cấp xã). */
export function book2kHtml(unit: Unit, campaign: Campaign, rows: BookRow[]): string {
  const start = dateOf(campaign.startDate);
  const end = dateOf(campaign.endDate);
  const d = (x?: Date) => (x ? `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}` : '........./........./..........');
  const cover = `<div class="page" style="text-align:center;padding-top:40pt">
    ${unit.parentUnit.trim() ? `<div class="upper">${esc(unit.parentUnit)}</div>` : ''}
    <div class="upper"><b>${esc(unit.unitName) || '....................'}</b></div>
    <div style="margin-top:36pt">Quyển số: ${fill(campaign.bookNumber, 10)}</div>
    <div style="margin-top:60pt;font-size:22pt"><b>SỔ THỐNG KÊ</b></div>
    <div style="font-size:16pt"><b>Sơ tuyển sức khỏe nghĩa vụ quân sự</b></div>
    <div class="italic" style="margin-top:12pt">Bắt đầu ngày ${d(start)} &nbsp; Kết thúc ngày ${d(end)}</div>
  </div>`;
  const body = rows
    .map(({ citizen: c, screening: s }, i) => {
      const mark = (o: Screening['outcome']) => (s.outcome === o ? 'x' : '');
      return `<tr>
        <td class="num">${i + 1}</td><td>${esc(c.fullName)}</td><td class="num">${esc(viDate(c.birthDate))}</td><td>${esc(addressOf(c))}</td>
        <td class="num">${esc(c.cccd)}</td><td class="num">${whole(s.heightCm)}</td><td class="num">${whole(s.weightKg)}</td><td class="num">${whole(s.chestCm)}</td>
        <td>${esc(healthStatusText(c, s))}${s.outcome !== 'eligible' && s.outcomeReason ? `<br><i>${esc(s.outcomeReason)}</i>` : ''}</td>
        <td class="num">${mark('eligible')}</td><td class="num">${mark('exempt')}</td><td class="num">${mark('other')}</td>
      </tr>`;
    })
    .join('');
  const count = (o: Screening['outcome']) => rows.filter((r) => r.screening.outcome === o).length;
  const table = `<div class="page">
    <p class="sub" style="margin-bottom:6pt">Sổ Thống kê sơ tuyển sức khỏe nghĩa vụ quân sự – Năm ${campaign.year}</p>
    <table class="grid xs">
      <thead>
        <tr><th rowspan="3">TT</th><th rowspan="3">Họ và tên</th><th rowspan="3">Ngày sinh</th><th rowspan="3">Địa chỉ</th><th rowspan="3">Số CCCD</th>
          <th colspan="3">Thể lực</th><th rowspan="3">Tình trạng sức khỏe và bệnh tật</th><th colspan="3">Kết luận</th></tr>
        <tr><th rowspan="2">Cao (cm)</th><th rowspan="2">Cân nặng (kg)</th><th rowspan="2">Vòng ngực TB (cm)</th>
          <th rowspan="2">Đủ điều kiện khám sức khỏe NVQS</th><th colspan="2">Không đủ ĐK KSK NVQS</th></tr>
        <tr><th>Thuộc diện miễn làm NVQS</th><th>Lý do khác</th></tr>
      </thead>
      <tbody>${body}
        <tr><td></td><td colspan="8"><b>Cộng</b> (${rows.length} công dân)</td><td class="num"><b>${count('eligible')}</b></td><td class="num"><b>${count('exempt')}</b></td><td class="num"><b>${count('other')}</b></td></tr>
      </tbody>
    </table>
  </div>`;
  return htmlDocument(`Sổ thống kê sơ tuyển NVQS năm ${campaign.year}`, cover + table, '@page { margin: 12mm; }');
}

/** Danh sách công dân mắc bệnh miễn đăng ký NVQS – điểm d khoản 3 Điều 7 Thông tư 105/2023/TT-BQP. */
export function exemptListHtml(unit: Unit, campaign: Campaign, rows: BookRow[], reportDate: Date, communeCouncil: string): string {
  const body = rows
    .map(({ citizen: c, screening: s }, i) => {
      const diseases = s.exemptionIds
        .map((id) => exemptDisease(id))
        .filter((d) => d !== undefined)
        .map((d) => (d.icd10 ? `${d.name} (${d.icd10})` : d.name))
        .join('; ');
      return `<tr><td class="num">${i + 1}</td><td>${esc(c.fullName)}</td><td class="num">${esc(viDate(c.birthDate))}</td><td class="num">${esc(c.cccd)}</td><td>${esc(addressOf(c))}</td><td>${esc(diseases)}</td><td>${esc(s.healthNote ?? '')}</td></tr>`;
    })
    .join('');
  const html = `<div class="page">
    ${nationalHeader(unit, `<div class="italic" style="margin-top:4pt">${dateLine(unit.placeName, reportDate)}</div>`)}
    <h1 style="margin-top:16pt">Danh sách</h1>
    <p class="sub">Công dân mắc các bệnh thuộc danh mục bệnh miễn đăng ký nghĩa vụ quân sự</p>
    <p class="center italic">(Mục III Phụ lục I Thông tư số 105/2023/TT-BQP) – Sơ tuyển sức khỏe NVQS năm ${campaign.year}</p>
    <p class="center">Kính gửi: ${esc(communeCouncil) || 'Hội đồng nghĩa vụ quân sự cấp xã'}</p>
    <table class="grid small">
      <tr><th>TT</th><th>Họ và tên</th><th>Ngày sinh</th><th>Số CCCD</th><th>Địa chỉ</th><th>Bệnh (mã ICD-10)</th><th>Ghi chú</th></tr>
      ${body || '<tr><td colspan="7" class="center">Không có công dân thuộc diện này</td></tr>'}
    </table>
    <p>Tổng số: ${rows.length} công dân.</p>
    <table class="sign"><tr><td></td><td><div><b>TỔ TRƯỞNG</b></div><div><b>TỔ SƠ TUYỂN SỨC KHỎE</b></div><div class="italic">(Ký tên, ghi rõ họ tên)</div><div class="name">${esc(unit.teamLeader)}</div></td></tr></table>
  </div>`;
  return htmlDocument(`Danh sách bệnh miễn đăng ký NVQS năm ${campaign.year}`, html);
}

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Mẫu 2k as CSV (UTF-8 with BOM so Excel shows Vietnamese correctly). */
export function book2kCsv(rows: BookRow[]): string {
  const header = [
    'TT',
    'Họ và tên',
    'Ngày sinh',
    'Giới tính',
    'Địa chỉ',
    'Số CCCD',
    'Cao (cm)',
    'Cân nặng (kg)',
    'Vòng ngực TB (cm)',
    'Mạch',
    'Huyết áp',
    'Tình trạng sức khỏe và bệnh tật',
    'Đủ điều kiện khám sức khỏe NVQS',
    'Không đủ ĐK - Thuộc diện miễn làm NVQS',
    'Không đủ ĐK - Lý do khác',
    'Lý do',
    'Ngày sơ tuyển',
  ];
  const lines = rows.map(({ citizen: c, screening: s }, i) =>
    [
      i + 1,
      c.fullName,
      viDate(c.birthDate),
      sexText(c),
      addressOf(c),
      `'${c.cccd}`,
      whole(s.heightCm),
      whole(s.weightKg),
      whole(s.chestCm),
      s.pulse,
      (() => {
        const bp = recordedBloodPressure(s);
        return bp ? `${bp.systolic}/${bp.diastolic}` : '';
      })(),
      healthStatusText(c, s),
      s.outcome === 'eligible' ? 'x' : '',
      s.outcome === 'exempt' ? 'x' : '',
      s.outcome === 'other' ? 'x' : '',
      s.outcomeReason,
      viDate(s.screenedOn),
    ]
      .map(csvCell)
      .join(','),
  );
  return `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}
