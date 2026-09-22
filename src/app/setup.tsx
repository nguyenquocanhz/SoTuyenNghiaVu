import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, InfoBanner, Screen, SelectField, TextField, type SelectOption } from '@/components';
import { collapseSpaces } from '@/domain/inputs';
import { ADMIN_UNITS_SOURCE, PROVINCES } from '@/standards/adminUnits';
import { communeFullName, findCommune, findProvince, looksLikePersonName, parentUnitName, provinceFullName, stationName } from '@/standards/stations';
import { useDataStore } from '@/store/data';
import { useSettingsStore } from '@/store/settings';
import { type } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

const PROVINCE_OPTIONS: SelectOption[] = PROVINCES.map((p) => ({ value: p.code, label: provinceFullName(p), subtitle: `${p.communes.length} xã, phường, đặc khu` }));

export default function SetupScreen() {
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const onboarding = params.onboarding === '1';
  const settings = useSettingsStore();
  const hasCampaign = useDataStore((s) => s.campaigns.length > 0);

  const [provinceCode, setProvinceCode] = useState(settings.provinceCode);
  const [communeCode, setCommuneCode] = useState(settings.communeCode);
  const [parentUnit, setParentUnit] = useState(settings.parentUnit);
  const [unitName, setUnitName] = useState(settings.unitName);
  const [placeName, setPlaceName] = useState(settings.placeName);
  const [teamLeader, setTeamLeader] = useState(settings.teamLeader);
  const [examiner, setExaminer] = useState(settings.examiner);
  const [touched, setTouched] = useState(false);

  const province = findProvince(provinceCode);
  const communeOptions = useMemo<SelectOption[]>(
    () => (province ? province.communes.map((c) => ({ value: c.code, label: stationName(c), subtitle: `${communeFullName(c)} · mã ${c.code}` })) : []),
    [province],
  );

  const chooseProvince = (code: string) => {
    if (code === provinceCode) return;
    setProvinceCode(code);
    setCommuneCode(undefined);
  };

  const chooseCommune = (code: string) => {
    const c = findCommune(provinceCode, code);
    if (!c) return;
    setCommuneCode(code);
    setUnitName(stationName(c));
    setParentUnit(parentUnitName(c));
    setPlaceName(c.name);
  };

  const leaderWarning = collapseSpaces(teamLeader) && !looksLikePersonName(teamLeader) ? 'Có vẻ không phải họ tên người – kiểm tra lại (ví dụ: Nguyễn Thị Hoa).' : undefined;

  const errors = {
    unitName: collapseSpaces(unitName) ? undefined : 'Nhập tên trạm y tế.',
    teamLeader: collapseSpaces(teamLeader) ? undefined : 'Nhập họ tên tổ trưởng tổ sơ tuyển.',
  };

  const save = () => {
    setTouched(true);
    if (errors.unitName || errors.teamLeader) return;
    settings.update({
      provinceCode,
      communeCode,
      parentUnit: collapseSpaces(parentUnit),
      unitName: collapseSpaces(unitName),
      placeName: collapseSpaces(placeName),
      teamLeader: collapseSpaces(teamLeader),
      examiner: collapseSpaces(examiner),
    });
    if (onboarding && !hasCampaign) {
      // First run: create the campaign for the next enlistment year so screening can start right away.
      const now = new Date();
      const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
      const campaign = useDataStore.getState().saveCampaign({
        year,
        name: `Sơ tuyển sức khỏe NVQS năm ${year}`,
        startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      });
      settings.update({ activeCampaignId: campaign.id });
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen footer={<Button title={onboarding ? 'Bắt đầu sử dụng' : 'Lưu'} icon="check" size="lg" onPress={save} />}>
      {onboarding ? (
        <InfoBanner
          severity="info"
          title="Sơ tuyển sức khỏe nghĩa vụ quân sự"
          message="Ứng dụng hỗ trợ Trạm y tế cấp xã sơ tuyển theo Điều 7 Thông tư 105/2023/TT-BQP (sửa đổi bởi Thông tư 106/2025/TT-BQP): lập Phiếu sơ tuyển (Mẫu 2), Sổ thống kê (Mẫu 2k), Báo cáo kết quả (Mẫu 2a)."
        />
      ) : null}
      <Card title="Đơn vị thực hiện" subtitle="Chọn theo danh mục đơn vị hành chính từ 01/7/2025" icon="hospital-building">
        <SelectField
          label="Tỉnh, thành phố"
          value={provinceCode}
          options={PROVINCE_OPTIONS}
          onChange={chooseProvince}
          placeholder="Chọn tỉnh, thành phố"
          title="Chọn tỉnh, thành phố"
        />
        <SelectField
          label="Trạm y tế (xã, phường, đặc khu)"
          value={communeCode}
          options={communeOptions}
          onChange={chooseCommune}
          placeholder={province ? 'Chọn trạm y tế' : 'Chọn tỉnh, thành phố trước'}
          title={province ? `Trạm y tế – ${provinceFullName(province)}` : 'Trạm y tế'}
          disabled={!province}
          hint="Tự điền tên trạm, cơ quan chủ quản và địa danh bên dưới; vẫn sửa được."
        />
        <TextField
          label="Tên trạm y tế (in trên phiếu)"
          value={unitName}
          onChangeText={setUnitName}
          placeholder="VD: Trạm Y tế xã An Bình"
          maxLength={80}
          error={touched ? errors.unitName : undefined}
        />
        <TextField
          label="Cơ quan chủ quản"
          value={parentUnit}
          onChangeText={setParentUnit}
          placeholder="VD: UBND xã An Bình"
          maxLength={80}
          hint="Trạm y tế trực thuộc UBND cấp xã (Điều 2 Thông tư 43/2025/TT-BYT). Tỉnh chưa chuyển giao thì ghi đơn vị quản lý trực tiếp do UBND tỉnh giao."
        />
        <TextField label="Địa danh (ghi ngày tháng)" value={placeName} onChangeText={setPlaceName} placeholder="VD: An Bình" autoCapitalize="words" maxLength={40} />
      </Card>
      <Card title="Tổ sơ tuyển sức khỏe" icon="account-tie-outline">
        <TextField
          label="Tổ trưởng tổ sơ tuyển"
          value={teamLeader}
          onChangeText={setTeamLeader}
          autoCapitalize="words"
          maxLength={60}
          error={(touched && errors.teamLeader) || leaderWarning}
          hint="Họ và tên người ký Phiếu sơ tuyển, Báo cáo Mẫu 2a."
        />
        <TextField label="Người khám mặc định" value={examiner} onChangeText={setExaminer} autoCapitalize="words" maxLength={60} />
      </Card>
      <Text style={type.caption}>{`Danh mục: ${ADMIN_UNITS_SOURCE}`}</Text>
      <Text style={type.caption}>
        Theo Thông tư 106/2025/TT-BQP, Trạm y tế cấp xã sơ tuyển dưới sự chỉ đạo chuyên môn của Sở Y tế hoặc bệnh viện, trung tâm y tế trực thuộc Sở Y tế; giám sát của Ban chỉ huy quân sự cấp xã, Ban chỉ huy phòng thủ khu vực.
      </Text>
    </Screen>
  );
}
