# Sơ tuyển NVQS điện tử

[![CI](https://github.com/nguyenquocanhz/SoTuyenNghiaVu/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyenquocanhz/SoTuyenNghiaVu/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android-3DDC84.svg)](#8-ch%E1%BA%A1y-v%C3%A0-build)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-000020.svg)](https://docs.expo.dev/versions/v57.0.0/)
[![Offline](https://img.shields.io/badge/D%E1%BB%AF%20li%E1%BB%87u-tr%C3%AAn%20m%C3%A1y%2C%20kh%C3%B4ng%20g%E1%BB%ADi%20m%E1%BA%A1ng-brightgreen.svg)](#6-l%C6%B0u-tr%E1%BB%AF-v%C3%A0-b%E1%BA%A3o-v%E1%BB%87-d%E1%BB%AF-li%E1%BB%87u)

Ứng dụng Android hỗ trợ **Trạm y tế cấp xã** thực hiện **sơ tuyển sức khỏe nghĩa vụ quân sự** theo:

- **Thông tư 105/2023/TT-BQP** ngày 06/12/2023 của Bộ Quốc phòng – tiêu chuẩn sức khỏe, khám sức khỏe cho các đối tượng thuộc phạm vi quản lý của Bộ Quốc phòng (hiệu lực 01/01/2024).
- **Thông tư 106/2025/TT-BQP** ngày 30/9/2025 – sửa đổi, bổ sung Thông tư 105/2023/TT-BQP (hiệu lực 30/9/2025): chính quyền 2 cấp, Hội đồng khám sức khỏe khu vực, sửa Mục IV Phụ lục I, thay thế toàn bộ mẫu phiếu (Phụ lục V → Phụ lục I) và mẫu báo cáo (Phụ lục VI → Phụ lục II).

> [!IMPORTANT]
> Điểm, phân loại và kết luận do ứng dụng **gợi ý** để hỗ trợ tổ sơ tuyển. Kết luận trên phiếu do Tổ sơ tuyển sức khỏe chịu trách nhiệm; phân loại sức khỏe chính thức do Hội đồng khám sức khỏe khu vực thực hiện (Điều 8, 9).

## 1. Nghiệp vụ theo Điều 7 (sơ tuyển sức khỏe NVQS)

| Bước (khoản 3 Điều 7) | Trong ứng dụng |
| --- | --- |
| a) Ban CHQS cấp xã lập danh sách, tham mưu Chủ tịch UBND cấp xã gọi khám sơ tuyển (TT 106) | Tạo **đợt sơ tuyển** (năm, số lượng theo kế hoạch); thêm công dân bằng **quét chip CCCD** (NFC) hoặc nhập tay |
| b) Sơ tuyển: khai thác tiền sử bản thân, gia đình; phát hiện không đủ sức khỏe về thể lực, dị tật, dị dạng (Mục I, II Phụ lục I); bệnh miễn đăng ký NVQS (Mục III) | **Phiếu sơ tuyển**: thể lực (cân Bluetooth hoặc nhập tay), mạch – huyết áp, thị lực, tiền sử, chọn bệnh/tật từ danh mục 205 mục có điểm, 10 bệnh miễn đăng ký |
| c) Hoàn chỉnh thông tin sức khỏe theo **Mẫu 2** | Xuất PDF **Phiếu sơ tuyển sức khỏe NVQS** (từng người hoặc hàng loạt) |
| d) Lập danh sách công dân mắc bệnh miễn đăng ký NVQS, báo cáo HĐNVQS cấp xã | Xuất PDF **Danh sách bệnh miễn đăng ký NVQS** |
| đ) Tổng hợp, thống kê, báo cáo theo **Mẫu 2a, Mẫu 2k** | Xuất PDF **Báo cáo kết quả (Mẫu 2a)**, **Sổ thống kê (Mẫu 2k)** khổ A4 ngang, và CSV mở bằng Excel |

## 2. Tiêu chuẩn đã số hoá

### 2.1. Thể lực – Mục I Phụ lục I

| Điểm | Nam cao (cm) | Nam nặng (kg) | Vòng ngực (cm) | Nữ cao (cm) | Nữ nặng (kg) | BMI |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ≥ 163 | ≥ 51 | ≥ 81 | ≥ 154 | ≥ 48 | 18,5 – 24,9 |
| 2 | 160 – 162 | 47 – 50 | 78 – 80 | 152 – 153 | 44 – 47 | 25 – 26,9 |
| 3 | 157 – 159 | 43 – 46 | 75 – 77 | 150 – 151 | 42 – 43 | 27 – 29,9 |
| 4 | 155 – 156 | 41 – 42 | 73 – 74 | 148 – 149 | 40 – 41 | < 18,5 hoặc 30 – 34,9 |
| 5 | 153 – 154 | 40 | 71 – 72 | 147 | 38 – 39 | 35 – 39,9 |
| 6 | ≤ 152 | ≤ 39 | ≤ 70 | ≤ 146 | ≤ 37 | ≥ 40 |

- Quy tròn (Mục IV.1.a): từ 0,5 trở lên ghi là 1 đơn vị, từ 0,49 trở xuống bỏ phần lẻ (152,50 cm → 153 cm). Điểm tính trên số đã quy tròn; BMI tính từ số đã ghi.
- Vòng ngực trung bình = (hít vào tối đa + thở ra tối đa) / 2 – màn hình phiếu có ô tính sẵn.
- Điểm thể lực = điểm cao nhất trong các chỉ tiêu (Điều 6: loại N khi có ít nhất 1 chỉ tiêu bị điểm N).

### 2.2. Bệnh tật – Mục II Phụ lục I

- `src/standards/diseases.ts`: 13 chuyên khoa, 207 mục (số 1 – 205, giữ nguyên số trùng/thiếu như bản gốc), 911 dòng; mỗi dòng giữ nguyên ô "Điểm" (`4`, `3T`, `4-5`, `5, 6`, "Cho điểm theo mục 1.1…"). Dữ liệu được chép từ bản scan và đối chiếu lại từng trang.
- Thị lực (số 1–3, sửa đổi bởi TT 106): thị lực > 10/10 tính 10/10; mắt trái không bù mắt phải; tổng không kính < 19/10 thì cho điểm theo thị lực sau chỉnh kính tối đa (+1 điểm); cận thị từ −3D, viễn thị từ +1,5D có điểm riêng.
- Huyết áp (số 99): lấy mức cao hơn của HA tối đa và tối thiểu; kèm phân độ theo Quyết định 3192/QĐ-BYT (số 100).
- Mạch (số 101): 50 – 54 lần/phút là 3 – 4 điểm tuỳ nghiệm pháp Lian; ≥ 100 hoặc < 50 là 5 – 6 điểm.

### 2.3. Bệnh miễn đăng ký NVQS – Mục III Phụ lục I

Tâm thần (F20–F29), Động kinh (G40), Parkinson (G20), Mù một mắt (H54.4), Điếc (H90), Di chứng lao xương khớp (B90.2), Di chứng phong (B92), Bệnh lý ác tính (C00–C97; D00–D09; D45–D47), Nhiễm HIV (B20–B24; Z21), Khuyết tật mức độ đặc biệt nặng và nặng.

### 2.4. Gợi ý kết luận (cột Kết luận của Mẫu 2k)

Căn cứ: tiêu chuẩn chung thực hiện NVQS là **đạt sức khỏe loại 1, 2, 3** (điểm a khoản 1 Điều 4); loại sức khỏe là điểm cao nhất của các chỉ tiêu (Điều 6). Vì vậy **bất kỳ chỉ tiêu nào bị điểm 4 – 6** đều dẫn tới gợi ý không đủ điều kiện.

| Gợi ý | Điều kiện |
| --- | --- |
| Không đủ ĐK – **thuộc diện miễn làm NVQS** | Có bệnh thuộc Mục III |
| Không đủ ĐK – **lý do khác** | Có chỉ tiêu 4 – 6 điểm: thể lực (Mục I), thị lực/tật khúc xạ (số 1 – 3), huyết áp (số 99), mạch (số 101), bệnh/tật đã chọn (kể cả điểm kèm "T") |
| Chưa kết luận | Thiếu phép đo thông tư yêu cầu: chiều cao, cân nặng, vòng ngực (nam); tổng thị lực không kính dưới 19/10 mà chưa đo sau chỉnh kính tối đa (TT 106); 2 lần đo huyết áp chênh trên 10 mmHg (phải đo lại) |
| **Đủ điều kiện** khám sức khỏe NVQS | Các trường hợp còn lại |

- Cận thị từ −3D, viễn thị từ +1,5D có điểm cố định (4 – 6) nên kết luận được ngay, không cần chờ thị lực sau chỉnh kính.
- Huyết áp: nhập 2 lần đo, giá trị ghi nhận là trung bình (Mục IV số 99); chỉ đo 1 lần thì vẫn chấm nhưng nhắc đo lần 2.
- Mạch 50 – 54 lần/phút (3 – 4 điểm tuỳ nghiệm pháp Lian) không tự loại, chỉ nhắc làm nghiệm pháp.
- Điểm kèm "T": vẫn tính theo điểm (khoản 3 Điều 9) và nhắc hướng dẫn công dân điều trị.
- Màn hình **Chỉ dẫn khám (Mục IV)** tóm tắt cách đo thể lực, thị lực (theo TT 106), quy trình 10 bước đo huyết áp và nghiệm pháp Lian.

## 3. Biểu mẫu in (Thông tư 106/2025/TT-BQP)

| Mẫu | Nội dung | Tệp |
| --- | --- | --- |
| Mẫu 2 – Phụ lục I | Phiếu sơ tuyển sức khỏe nghĩa vụ quân sự (I. Sơ yếu lý lịch, II. Kết quả sơ tuyển, III. Ý kiến tổ sơ tuyển) | `src/reports/forms.ts` → `screeningFormPage` |
| Mẫu 2a – Phụ lục II | Báo cáo kết quả sơ tuyển sức khỏe NVQS | `report2aHtml` |
| Mẫu 2k – Phụ lục II | Sổ thống kê sơ tuyển sức khỏe NVQS (bìa + bảng) | `book2kHtml`, `book2kCsv` |
| Điểm d khoản 3 Điều 7 | Danh sách công dân mắc bệnh miễn đăng ký NVQS | `exemptListHtml` |

PDF tạo bằng `expo-print` (A4, cỡ chữ 13), mỗi mẫu có hai nút:

- **In / Lưu PDF** – hộp thoại in của Android: chọn máy in (in ra để tổ trưởng ký) hoặc “Lưu dạng PDF” vào bộ nhớ máy.
- **Chia sẻ PDF** – gửi qua Zalo, Gmail, Drive… bằng `expo-sharing`.

Điện thoại Android không có Times New Roman nên mẫu in nhúng font **Tinos** (cùng số đo chữ với Times New Roman, SIL OFL 1.1, từ `@fontsource/tinos`) ở `src/reports/fonts.ts` – tạo lại bằng `node scripts/gen-print-fonts.mjs`. WebView in của Android dàn trang 72 px/inch nên `src/reports/output.ts` thu nhỏ `body` theo tỉ lệ 72/96 khi in trên Android để phiếu vừa 1 trang A4 như bản in trên máy tính.

## 4. Đọc chip CCCD

Module `modules/cccd-nfc` (Kotlin, JMRTD) đọc DG1 (MRZ) và DG13 sau khi xác thực PACE/BAC bằng số CCCD + ngày sinh + ngày hết hạn. Ngoài họ tên, ngày sinh, giới tính, ứng dụng lấy thêm các trường mà Mẫu 2 cho phép "khai thác trên CSDL quốc gia về dân cư": **số định danh**, **dân tộc**, **tôn giáo**, **quê quán**, **nơi thường trú**, **họ tên bố, mẹ**. Không đọc ảnh chân dung, vân tay. Samsung/Snapdragon (Galaxy Note 10) dùng khối 128 byte và giãn 15 ms giữa các APDU.

## 5. Thông tin đơn vị (chọn trạm y tế)

Cài đặt → Đơn vị: chọn **Tỉnh, thành phố** rồi **Trạm y tế (xã, phường, đặc khu)** từ danh sách có tìm kiếm không dấu; app tự điền tên trạm, cơ quan chủ quản, địa danh (vẫn sửa được). Tổ trưởng nhập tay, có cảnh báo khi nội dung không giống họ tên người.

- Danh mục `src/standards/adminUnits.ts`: **34 cấp tỉnh, 3.321 cấp xã** (2.599 xã, 709 phường, 13 đặc khu) lấy từ web service của Cục Thống kê https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx ngày 17/9/2026, theo Quyết định 19/2025/QĐ-TTg và các nghị quyết đã cập nhật đến 20/9/2026 (Đồng Nai, Quảng Ninh, Bắc Ninh thành thành phố). Mã số giữ nguyên theo QĐ 19/2025.
- Tên trạm: “Trạm Y tế {xã|phường|đặc khu} {tên}”; cơ quan chủ quản: “UBND {xã|phường|đặc khu} {tên}” – trạm y tế trực thuộc UBND cấp xã (Điều 2 Thông tư 43/2025/TT-BYT; tỉnh chưa hoàn thành chuyển giao thì theo đơn vị quản lý do UBND tỉnh giao, Điều 8). Trên phiếu in hoa theo Nghị định 30/2020/NĐ-CP.

## 6. Lưu trữ và bảo vệ dữ liệu

- SQLite trên máy (`sotuyen.db`: `campaigns`, `citizens` – CCCD duy nhất, `screenings` – mỗi công dân một phiếu/đợt); cài đặt trong `expo-sqlite/kv-store`.
- Phiếu **tự lưu** 0,8 giây sau mỗi thay đổi.
- Cài đặt → Sao lưu (JSON) / Khôi phục / Xoá toàn bộ. Dữ liệu cá nhân nhạy cảm (sức khỏe) – bảo quản tệp sao lưu theo Nghị định 13/2023/NĐ-CP.
- **Gộp dữ liệu** (không xoá dữ liệu đang có) – dùng khi nhiều máy cùng sơ tuyển rồi tập hợp về trạm (`src/domain/merge.ts`): đợt khớp theo năm, công dân khớp theo số CCCD (chỉ bổ sung trường có giá trị), phiếu cùng đợt chỉ thay khi bản nhập mới hơn.
  - Từ tệp: Cài đặt → Gộp dữ liệu từ tệp.
  - Từ liên kết/mã QR: `sotuyennghiavu://import?data=<JSON sao lưu, mã hoá URL>` mở màn hình **Nhập dữ liệu**, luôn xem trước và chỉ ghi khi bấm “Gộp vào dữ liệu trên máy”. Ví dụ qua adb: `adb shell am start -a android.intent.action.VIEW -d 'sotuyennghiavu://import?data=...' vn.sotuyen.nghiavu`.

## 7. Cấu trúc

```text
src/
├── app/                    # expo-router
│   ├── (tabs)/             # Tổng quan · Công dân · Báo cáo · Tiêu chuẩn
│   ├── setup.tsx           # Thông tin đơn vị, tổ trưởng (onboarding)
│   ├── campaigns.tsx, campaign-form.tsx
│   ├── scan-cccd.tsx       # Quét chip CCCD
│   ├── citizen-form.tsx, citizen/[id].tsx
│   ├── screening/[citizenId].tsx   # Phiếu sơ tuyển
│   ├── disease-picker.tsx  # Chọn bệnh, tật (Mục II)
│   ├── measure-weight.tsx, devices.tsx   # Cân Bluetooth
│   ├── standards/[specialty].tsx
│   └── settings.tsx
├── domain/                 # physique, vision, vitals, screening, inputs, format, search (thuần, có test)
├── standards/              # diseases (Mục II), exemptions (Mục III), catalog, scoreText
├── reports/                # HTML mẫu 2, 2a, 2k, danh sách miễn; xuất PDF/CSV
├── db/                     # SQLite
├── store/                  # zustand: data, settings, drafts (bộ nhớ tạm), selectors
├── ble/, hooks/            # cân Bluetooth (Xiaomi, OKOK, QN, SIG), mô phỏng
└── components/, theme/
modules/cccd-nfc/           # Expo native module đọc CCCD (Android)
```

## 8. Chạy và build

```bash
npm install
npm test                      # 427 test (tiêu chuẩn, báo cáo, BLE, CCCD)
npm run typecheck
npx expo prebuild --platform android
cd android && gradlew.bat assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Bộ icon trong `assets/images/` sinh bằng `python scripts/gen-app-icon.py` (cần Pillow): hình phiếu sơ tuyển kèm đường nhịp tim trên nền xanh `#2D5F3A` của giao diện, gồm icon iOS, ba lớp adaptive icon của Android (nền, lớp trước, monochrome cho theme icon), ảnh splash và favicon. Sửa hình thì sửa script rồi chạy lại, đừng sửa tay từng tệp PNG.

Yêu cầu: Node 20+, JDK 17+, Android SDK. Ứng dụng dùng native module (NFC, Bluetooth, SQLite) nên không chạy trong Expo Go. Bản release hiện ký bằng debug keystore của template – cần tạo keystore riêng trước khi phát hành.

## 9. Cài đặt bản APK

Tải `app-release.apk` ở mục [Releases](https://github.com/nguyenquocanhz/SoTuyenNghiaVu/releases), chép sang điện thoại Android và mở để cài (cho phép "Cài đặt ứng dụng không rõ nguồn gốc"). Bản này ký bằng debug keystore của template React Native nên chỉ dùng để chạy thử, không phải bản phân phối chính thức; muốn phát hành thì tự tạo keystore theo https://reactnative.dev/docs/signed-apk-android.

## 10. Giấy phép, đóng góp, bảo mật

- **Mã nguồn**: [Apache License 2.0](LICENSE). Thành phần bên thứ ba, thư viện native (JMRTD, SCUBA, Bouncy Castle – LGPL) và font Tinos nhúng trong bản in (SIL OFL 1.1): xem [NOTICE](NOTICE).
- **Văn bản thông tư**: theo khoản 2 Điều 15 Luật Sở hữu trí tuệ, văn bản quy phạm pháp luật không thuộc phạm vi bảo hộ quyền tác giả. Bản chép trong repo **không phải bản công bố chính thức**: chép từ bản scan, đối chiếu từng trang, nhưng có khác biệt thì lấy bản của Bộ Quốc phòng làm chuẩn – và xin mở issue “Sai lệch so với thông tư”.
- **Đóng góp**: xem [CONTRIBUTING.md](CONTRIBUTING.md). Quy tắc quan trọng nhất: không đưa dữ liệu thật của công dân vào mã nguồn, test, issue hay ảnh chụp màn hình.
- **Lỗ hổng bảo mật**: báo riêng tư theo [SECURITY.md](SECURITY.md), đừng mở issue công khai.
- **Trách nhiệm chuyên môn**: ứng dụng chỉ gợi ý điểm và kết luận. Người khám và Tổ trưởng tổ sơ tuyển chịu trách nhiệm về nội dung phiếu; phân loại sức khỏe chính thức do Hội đồng khám sức khỏe NVQS khu vực thực hiện (Điều 8, 9 Thông tư 105/2023/TT-BQP). Đây không phải thiết bị y tế.

## 11. English summary

An offline Android app that helps a Vietnamese commune health station (Trạm y tế cấp xã) run the military-service health **pre-screening** required by Điều 7 of Thông tư 105/2023/TT-BQP, as amended by Thông tư 106/2025/TT-BQP.

It digitises the standards of Phụ lục I — physique table (Mục I), the 207-entry disease catalogue (Mục II), the diseases exempt from conscription registration (Mục III) and the examination rules of Mục IV (rounding, corrected vision, two blood-pressure readings, pulse) — scores each candidate the way the circular does (the worst criterion sets the class), and prints the statutory forms as A4 PDFs: Phiếu sơ tuyển (Mẫu 2), Báo cáo kết quả (Mẫu 2a) and Sổ thống kê (Mẫu 2k, landscape, also exportable as CSV).

Records live in SQLite on the phone and the app makes **no network calls**. A candidate's identity can be prefilled by reading the chip of a CCCD card over NFC (PACE/BAC, DG1 + DG13 only, no Passive Authentication — it is not identity verification), and weight can be read from Bluetooth LE scales. Several phones can screen in parallel and merge into one device through a backup file or a `sotuyennghiavu://import?data=…` link, always behind an explicit confirmation step.

Built with Expo SDK 57 / React Native 0.86, TypeScript strict, 427 unit tests. Scores and conclusions are **suggestions**: the examiner and the screening team leader stay responsible for the form, and the official health classification is made by the regional medical board. Not a medical device.
