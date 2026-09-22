import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ListRow, Screen, ScoreBadge, SectionHeader } from '@/components';
import { PHYSIQUE_TABLE } from '@/domain/physique';
import { DISEASE_CATALOG } from '@/standards/catalog';
import { EXEMPT_DISEASES } from '@/standards/exemptions';
import { colors, spacing, type } from '@/theme';

const LOAI = [
  ['Loại 1', 'Tất cả các chỉ tiêu đều đạt điểm 1'],
  ['Loại 2', 'Có ít nhất 1 chỉ tiêu bị điểm 2'],
  ['Loại 3', 'Có ít nhất 1 chỉ tiêu bị điểm 3'],
  ['Loại 4', 'Có ít nhất 1 chỉ tiêu bị điểm 4'],
  ['Loại 5', 'Có ít nhất 1 chỉ tiêu bị điểm 5'],
  ['Loại 6', 'Có ít nhất 1 chỉ tiêu bị điểm 6'],
];

export default function StandardsScreen() {
  return (
    <Screen>
      <Card title="Phân loại sức khỏe" subtitle="Điều 6 Thông tư 105/2023/TT-BQP" icon="format-list-numbered">
        <Text style={type.body}>Mỗi chỉ tiêu được cho điểm chẵn 1–6: 1 rất tốt · 2 tốt · 3 khá · 4 trung bình · 5 kém · 6 rất kém.</Text>
        {LOAI.map(([l, d]) => (
          <View key={l} style={styles.loaiRow}>
            <Text style={[type.bodyStrong, styles.loai]}>{l}</Text>
            <Text style={[type.body, styles.flex]}>{d}</Text>
          </View>
        ))}
        <Text style={type.caption}>
          Gọi nhập ngũ: đạt sức khỏe loại 1, 2, 3; không gọi nhập ngũ công dân nghiện ma túy, tiền chất ma túy (Nghị định 57/2022/NĐ-CP). Điểm kèm chữ “T” là tạm thời.
        </Text>
      </Card>

      <Card>
        <ListRow title="Chỉ dẫn khám tuyển (Mục IV)" subtitle="Cách đo, quy tròn thể lực · thị lực (TT 106) · huyết áp, mạch" icon="clipboard-text-search-outline" onPress={() => router.push('/guide')} />
      </Card>

      <SectionHeader title="Mục I – Thể lực" />
      <Card>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.cell, styles.cLoai, styles.hText]}>Điểm</Text>
          <Text style={[styles.cell, styles.hText]}>Nam cao (cm)</Text>
          <Text style={[styles.cell, styles.hText]}>Nam nặng (kg)</Text>
          <Text style={[styles.cell, styles.hText]}>Vòng ngực (cm)</Text>
        </View>
        {PHYSIQUE_TABLE.map((r) => (
          <View key={r.score} style={styles.tr}>
            <View style={[styles.cell, styles.cLoai]}>
              <ScoreBadge score={r.score} compact />
            </View>
            <Text style={styles.cell}>{r.maleHeight}</Text>
            <Text style={styles.cell}>{r.maleWeight}</Text>
            <Text style={styles.cell}>{r.maleChest}</Text>
          </View>
        ))}
        <View style={[styles.tr, styles.th, styles.gap]}>
          <Text style={[styles.cell, styles.cLoai, styles.hText]}>Điểm</Text>
          <Text style={[styles.cell, styles.hText]}>Nữ cao (cm)</Text>
          <Text style={[styles.cell, styles.hText]}>Nữ nặng (kg)</Text>
          <Text style={[styles.cell, styles.hText]}>BMI (nam, nữ)</Text>
        </View>
        {PHYSIQUE_TABLE.map((r) => (
          <View key={r.score} style={styles.tr}>
            <View style={[styles.cell, styles.cLoai]}>
              <ScoreBadge score={r.score} compact />
            </View>
            <Text style={styles.cell}>{r.femaleHeight}</Text>
            <Text style={styles.cell}>{r.femaleWeight}</Text>
            <Text style={styles.cell}>{r.bmi}</Text>
          </View>
        ))}
        <Text style={type.caption}>
          Quy tròn: từ 0,5 trở lên ghi là 1 đơn vị, từ 0,49 trở xuống bỏ phần lẻ. Vòng ngực TB = (hít vào tối đa + thở ra tối đa) / 2. BMI = cân nặng (kg) / chiều cao (m)².
        </Text>
      </Card>

      <SectionHeader title="Mục II – Bệnh tật và các vấn đề sức khỏe" />
      <Card>
        {DISEASE_CATALOG.map((s) => (
          <ListRow
            key={s.id}
            title={`${s.no}. ${s.name}`}
            subtitle={`Số ${s.items[0]?.no} – ${s.items[s.items.length - 1]?.no} · ${s.items.length} mục`}
            icon="book-open-page-variant-outline"
            onPress={() => router.push({ pathname: '/standards/[specialty]', params: { specialty: s.id } })}
          />
        ))}
      </Card>

      <SectionHeader title="Mục III – Bệnh miễn đăng ký NVQS" />
      <Card>
        {EXEMPT_DISEASES.map((d) => (
          <View key={d.id} style={styles.loaiRow}>
            <Text style={[type.bodyStrong, styles.no]}>{d.no}</Text>
            <Text style={[type.body, styles.flex]}>{d.name}</Text>
            <Text style={[type.caption, styles.icd]}>{d.icd10}</Text>
          </View>
        ))}
      </Card>

      <Text style={type.caption}>
        Nguồn: Phụ lục I Thông tư 105/2023/TT-BQP ngày 06/12/2023; Thông tư 106/2025/TT-BQP ngày 30/9/2025 sửa đổi Mục IV (thị lực, mộng thịt, sụp mi, mù màu, phiếu chẩn đoán nhanh tâm thần) và thay thế các mẫu phiếu, báo cáo.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loaiRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 2 },
  loai: { width: 56 },
  no: { width: 20 },
  icd: { width: 110, textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, minHeight: 34 },
  th: { backgroundColor: colors.primarySoft },
  gap: { marginTop: spacing.md },
  cell: { flex: 1, fontSize: 13, color: colors.text, paddingHorizontal: 4, textAlign: 'center' },
  cLoai: { flex: 0.8, alignItems: 'center' },
  hText: { fontWeight: '700', color: colors.primary },
});
