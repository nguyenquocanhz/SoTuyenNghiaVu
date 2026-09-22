import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Screen, SegmentedControl, type SegmentOption } from '@/components';
import { colors, spacing, type } from '@/theme';

/**
 * Mục IV "Chỉ dẫn khám tuyển" Phụ lục I Thông tư 105/2023/TT-BQP, phần dùng khi sơ tuyển;
 * mục thị lực theo khoản 8 Điều 1 Thông tư 106/2025/TT-BQP.
 */
type Section = 'physique' | 'vision' | 'vitals';

const OPTIONS: SegmentOption<Section>[] = [
  { value: 'physique', label: 'Thể lực' },
  { value: 'vision', label: 'Thị lực' },
  { value: 'vitals', label: 'HA, mạch' },
];

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((t) => (
        <View key={t} style={styles.item}>
          <Text style={styles.dot}>•</Text>
          <Text style={[type.body, styles.flex]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <View>
      <View style={[styles.tr, styles.th]}>
        {head.map((h) => (
          <Text key={h} style={[styles.td, styles.thText]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.join('|')} style={styles.tr}>
          {r.map((c, i) => (
            <Text key={i} style={styles.td}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function GuideScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Section>(
    params.section === 'vision' || params.section === 'vitals' ? params.section : 'physique',
  );

  return (
    <Screen>
      <SegmentedControl options={OPTIONS} value={section} onChange={setSection} />

      {section === 'physique' ? (
        <>
          <Card title="Quy tròn số liệu" subtitle="Mục IV.1.a" icon="numeric">
            <Text style={type.body}>Chiều cao, vòng ngực, cân nặng từ 0,5 trở lên ghi là 1 đơn vị; từ 0,49 trở xuống thì không lấy phần lẻ.</Text>
            <Table
              head={['Đo được', 'Ghi']}
              rows={[
                ['152,50 cm', '153 cm'],
                ['158,49 cm', '158 cm'],
                ['46,50 kg', '47 kg'],
                ['51,49 kg', '51 kg'],
                ['82,50 cm (ngực)', '83 cm'],
                ['79,49 cm (ngực)', '79 cm'],
              ]}
            />
          </Card>
          <Card title="Cách khám thể lực" subtitle="Mục IV.1.b" icon="human-male-height">
            <Bullets
              items={[
                'Bỏ mũ, nón, không đi giày dép (chân đất, đầu trần). Nam cởi hết quần áo dài, áo lót, chỉ mặc 1 quần đùi; nữ mặc quần dài, áo mỏng.',
                'Đo chiều cao: đứng thẳng, 2 gót chân chạm nhau, 2 tay buông thõng tự nhiên, mắt nhìn ngang.',
                'Thước ở bàn cân: kéo phần trên hết cỡ rồi điều chỉnh lấy kết quả phần dưới. Thước kẻ trên tường/cột: tường thẳng đứng, nền phẳng vuông góc; gót chân, mông, xương bả vai chạm tường; thước chạm đỉnh đầu vuông góc với tường.',
                'Vòng ngực (nam): vòng qua núm vú phía trước, 2 bờ dưới xương bả vai phía sau, vuông góc trục thân; đo khi hít vào tối đa và thở ra tối đa.',
                'Vòng ngực trung bình = (hít vào tối đa + thở ra tối đa) / 2.',
                'BMI = cân nặng (kg) / chiều cao (m)².',
              ]}
            />
          </Card>
        </>
      ) : null}

      {section === 'vision' ? (
        <>
          <Card title="Đo thị lực" subtitle="Số 1 Mục IV.2 – sửa đổi bởi TT 106/2025/TT-BQP" icon="eye-outline">
            <Bullets
              items={[
                'Nhân viên chuyên môn trực tiếp hướng dẫn cách đọc, đúng kỹ thuật Nhãn khoa; người đọc không trung thực hoặc không biết đọc thì dùng máy đo khúc xạ tự động để kiểm tra.',
                'Bảng chữ đen nền trắng, hàng 7/10 – 8/10 ngang tầm mắt; ánh sáng khoảng 400 – 700 lux, không loá, không tối; cự ly theo quy định của bảng.',
                'Che 1 mắt bằng miếng bìa cứng (không che bằng tay), cả 2 mắt đều mở.',
                'Que chỉ dưới từng chữ, đọc mỗi chữ dưới 10 giây. Hàng 8/10, 9/10, 10/10 mỗi hàng chỉ được sai 1 chữ.',
                'Tổng thị lực 2 mắt: mắt nào trên 10/10 vẫn chỉ tính 10/10 (ví dụ MP 12/10, MT 5/10 → tổng 15/10).',
                'Mắt trái không bù được cho mắt phải; thị lực mắt phải vẫn phải đạt tiêu chuẩn.',
                'Thị lực không kính 2 mắt chưa đạt 19/10 thì phải đo thị lực sau chỉnh kính; chỉnh kính tối đa vẫn dưới 19/10 thì bác sĩ chuyên khoa mắt tìm nguyên nhân.',
                'Cho điểm: không kính đạt từ 19/10 → theo thị lực không kính; không đạt 19/10 → theo thị lực sau chỉnh kính tối đa.',
              ]}
            />
          </Card>
          <Card title="Điểm thị lực, tật khúc xạ" subtitle="Số 1–3 Mục II.1" icon="table">
            <Table
              head={['Mắt phải', 'Tổng 2 mắt', 'Điểm']}
              rows={[
                ['10/10', '19/10', '1'],
                ['10/10', '18/10', '2'],
                ['9/10', '17/10', '3'],
                ['8/10', '16/10', '4'],
                ['6, 7/10', '13 – 15/10', '5'],
                ['1 – 5/10', '6 – 12/10', '6'],
              ]}
            />
            <Text style={type.body}>Thị lực sau chỉnh kính: cho điểm như trên và tăng 1 điểm.</Text>
            <Table
              head={['Tật khúc xạ', 'Điểm']}
              rows={[
                ['Cận dưới −3D', 'theo thị lực sau chỉnh kính'],
                ['Cận −3D đến dưới −4D', '4'],
                ['Cận −4D đến dưới −5D', '5'],
                ['Cận từ −5D', '6'],
                ['Viễn dưới +1,5D', 'theo thị lực không kính'],
                ['Viễn +1,5D đến dưới +3D', '4'],
                ['Viễn +3D đến dưới +4D', '5'],
                ['Viễn +4D đến dưới +5D', '6'],
                ['Đã phẫu thuật', 'theo thị lực không kính, tăng 1 điểm'],
              ]}
            />
          </Card>
        </>
      ) : null}

      {section === 'vitals' ? (
        <>
          <Card title="Quy trình đo huyết áp" subtitle="Số 99 Mục IV.6 – theo QĐ 3192/QĐ-BYT" icon="heart-pulse">
            <Bullets
              items={[
                '1. Nghỉ trong phòng yên tĩnh ít nhất 5 – 10 phút.',
                '2. Không dùng chất kích thích (cà phê, thuốc lá, rượu, bia) trong 2 giờ trước đó.',
                '3. Ngồi ghế tựa, cánh tay duỗi thẳng trên bàn, nếp khuỷu ngang mức tim.',
                '4. Huyết áp kế thủy ngân, đồng hồ hoặc điện tử (đo ở cánh tay), kiểm chuẩn định kỳ; bao đo dài ≥ 80%, rộng ≥ 40% chu vi cánh tay; bờ dưới bao đo trên nếp khuỷu 2 cm.',
                '5. Đo tay: bơm thêm 30 mmHg sau khi mất mạch, xả 2 – 3 mmHg/nhịp; tâm thu lúc xuất hiện tiếng đập đầu tiên (Korotkoff I), tâm trương lúc mất hẳn tiếng đập (Korotkoff V).',
                '6. Không nói chuyện khi đo.',
                '7. Lần đầu đo cả hai tay, theo dõi tay có số cao hơn.',
                '8. Đo ít nhất hai lần cách nhau 1 – 2 phút; chênh trên 10 mmHg thì nghỉ trên 5 phút rồi đo lại. Giá trị ghi nhận là trung bình hai lần đo cuối.',
                '9. Nghi ngờ thì theo dõi bằng máy đo tự động tại nhà hoặc Holter huyết áp 24 giờ.',
                '10. Ghi theo mmHg dạng tâm thu/tâm trương (ví dụ 126/82 mmHg), không làm tròn quá hàng đơn vị.',
                'Tâm thu và tâm trương khác mức phân loại thì lấy mức cao hơn.',
              ]}
            />
          </Card>
          <Card title="Điểm huyết áp" subtitle="Số 99 Mục II.8" icon="table">
            <Table
              head={['Điểm', 'HA tối đa', 'HA tối thiểu']}
              rows={[
                ['1', '110 – 120', '≤ 80'],
                ['2', '121 – 130 hoặc 100 – 109', '81 – 85'],
                ['3', '131 – 139 hoặc 90 – 99', '86 – 89'],
                ['4', '140 – 149 hoặc < 90', '90 – 99'],
                ['5', '150 – 159', '≥ 100'],
                ['6', '≥ 160', ''],
              ]}
            />
            <Table
              head={['Phân độ QĐ 3192 (điểm bệnh THA, số 100)', 'Tâm thu', 'Tâm trương']}
              rows={[
                ['Tối ưu', '< 120', '< 80'],
                ['Bình thường', '120 – 129', '80 – 84'],
                ['Tiền tăng huyết áp', '130 – 139', '85 – 89'],
                ['Tăng HA độ 1 (4 điểm)', '140 – 159', '90 – 99'],
                ['Tăng HA độ 2 (5 điểm)', '160 – 179', '100 – 109'],
                ['Tăng HA độ 3 (6 điểm)', '≥ 180', '≥ 110'],
                ['Tăng HA tâm thu đơn độc', '≥ 140', '< 90'],
              ]}
            />
          </Card>
          <Card title="Mạch" subtitle="Số 101 Mục II.8, Mục IV.6" icon="pulse">
            <Table
              head={['Mạch khi nghỉ (lần/phút)', 'Điểm']}
              rows={[
                ['60 – 80', '1'],
                ['81 – 85 hoặc 57 – 59', '2'],
                ['86 – 90 hoặc 55 – 56', '3'],
                ['50 – 54', '3 – 4 (nghiệm pháp Lian)'],
                ['91 – 99', '4'],
                ['≥ 100 hoặc < 50', '5, 6'],
              ]}
            />
            <Bullets
              items={[
                'Bắt mạch quay 2 bên đồng thời; có ngoại tâm thu thì nghe tim, đếm số ngoại tâm thu trong 1 phút.',
                'Mạch thường xuyên khi nghỉ ≥ 90 lần/phút: khám chuyên khoa tim mạch và nội tiết tại bệnh viện.',
                'Nghiệm pháp Lian: đứng lấy mạch, chạy tại chỗ 10 – 12 bước/5 giây trong 5 phút; lấy mạch 15 giây đầu mỗi phút 1 – 5. Đầu phút 2 – 3 mạch trở lại như cũ là bình thường; đầu phút 1 mạch ≥ 140 hoặc phút 4 – 5 mới trở lại là xấu (từ loại 4); đầu phút 6 mới trở lại xếp loại 4.',
                'Mạch thường xuyên khi nghỉ < 50 lần/phút: làm nghiệm pháp Atropin tại cơ sở có điều kiện.',
              ]}
            />
          </Card>
        </>
      ) : null}

      <Text style={type.caption}>
        Trích Mục IV “Chỉ dẫn khám tuyển” Phụ lục I Thông tư 105/2023/TT-BQP; phần thị lực theo khoản 8 Điều 1 Thông tư 106/2025/TT-BQP.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.xs },
  item: { flexDirection: 'row', gap: spacing.sm },
  dot: { ...type.body, color: colors.primary, width: 10 },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, minHeight: 32, alignItems: 'center' },
  th: { backgroundColor: colors.primarySoft },
  td: { flex: 1, fontSize: 13, color: colors.text, paddingHorizontal: 6, paddingVertical: 4 },
  thText: { fontWeight: '700', color: colors.primary },
});
