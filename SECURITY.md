# Chính sách bảo mật / Security Policy

> **Báo cáo riêng tư qua GitHub Security Advisory:**
> <https://github.com/nguyenquocanhz/SoTuyenNghiaVu/security/advisories/new>
> (tab **Security** → **Report a vulnerability**). **Đừng mở issue công khai cho lỗ hổng bảo mật.**
>
> *Report privately through a GitHub security advisory at the link above — please do not open a public issue for a vulnerability.*

> [!WARNING]
> Ứng dụng chứa **dữ liệu sức khỏe và nhân thân của công dân** (họ tên, ngày sinh, số CCCD, số đo, bệnh tật). Đây là dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023/NĐ-CP. Một lỗi ở đây không chỉ làm sai phiếu mà còn có thể làm lộ hồ sơ của cả một đợt sơ tuyển.

---

## 1. Phiên bản được hỗ trợ

Dự án do một người duy trì, chỉ có một dòng phát triển.

| Phiên bản | Được vá lỗi bảo mật |
| --- | --- |
| `main` (bản mới nhất) | Có |
| Bản build/APK cũ hơn | Không — hãy cập nhật lên `main` |

Không có chương trình thưởng lỗi. Thời gian phản hồi là **cố gắng tốt nhất**, thường vài ngày; nếu sau **14 ngày** chưa có hồi âm, bạn có thể mở một issue công khai **chỉ nói rằng đã gửi advisory** (không kèm chi tiết kỹ thuật).

## 2. Cách báo cáo

1. Mở <https://github.com/nguyenquocanhz/SoTuyenNghiaVu/security/advisories/new> (cần tài khoản GitHub). Kênh này riêng tư giữa bạn và người bảo trì.
2. Mô tả: thành phần bị ảnh hưởng, các bước tái hiện, tác động thực tế, commit đã thử, thiết bị và phiên bản Android.
3. **Tuyệt đối không gửi kèm dữ liệu thật của công dân**: không số CCCD, họ tên, ngày sinh, phiếu đã in, ảnh chụp màn hình có hồ sơ thật, tệp sao lưu thật. Dùng dữ liệu giả (ví dụ số CCCD `001203000001`).
4. Nếu có bản vá, đính kèm patch trong advisory — đừng mở pull request công khai trước khi lỗ hổng được vá.
5. Việc công bố sẽ thống nhất với bạn sau khi có bản vá; bạn được ghi nhận nếu muốn.

## 3. Phạm vi (in scope)

| Khu vực | Mã nguồn | Ví dụ điều đáng báo cáo |
| --- | --- | --- |
| **Dữ liệu lưu trên máy** | `src/db/`, `src/store/` | Hồ sơ công dân, số CCCD hoặc kết quả khám lọt ra log, thư mục chia sẻ, bản sao lưu của hệ điều hành, hoặc ứng dụng khác đọc được cơ sở dữ liệu SQLite. |
| **Nhập dữ liệu qua deep link** | `src/app/import.tsx`, `src/domain/merge.ts` | Link `sotuyennghiavu://import?data=…` do kẻ tấn công tạo mà **ghi được dữ liệu khi người dùng chưa bấm nút gộp**, làm sập ứng dụng, xoá hoặc ghi đè hồ sơ đang có, hay vượt qua màn hình xem trước. |
| **Nhập tệp sao lưu** | `src/app/settings.tsx`, `src/store/data.ts` | Tệp JSON dị dạng làm hỏng cơ sở dữ liệu, hoặc phần "gộp dữ liệu" xoá mất hồ sơ đang có. |
| **Xuất PDF/CSV và chia sẻ** | `src/reports/`, `expo-print`, `expo-sharing` | Tệp tạm chứa hồ sơ nằm lại ở nơi ứng dụng khác đọc được sau khi chia sẻ; nội dung do người dùng nhập gây chèn HTML vào phiếu in. |
| **Đọc dữ liệu NFC/CCCD không tin cậy** | [`modules/cccd-nfc`](modules/cccd-nfc) | Thẻ/chip giả mạo làm sập ứng dụng hoặc gây lỗi bộ nhớ; dữ liệu chip bị ghi ra log hoặc gửi đi. |
| **Đọc dữ liệu BLE không tin cậy** | `src/ble/` | Gói quảng bá do kẻ tấn công phát làm ứng dụng sập, treo, hoặc tạo ra cân nặng sai lệch nghiêm trọng mà vẫn được coi là "ổn định". |
| **Cấu hình Android** | [`app.json`](app.json), `modules/cccd-nfc/android` | Quyền thừa, component bị export ngoài ý muốn, cho phép lưu lượng không mã hoá, cho phép sao lưu đám mây kèm cơ sở dữ liệu. |

**Ứng dụng không gửi dữ liệu ra mạng.** Nếu bạn tìm được bất kỳ đường nào khiến hồ sơ rời khỏi máy mà không do người dùng chủ động chia sẻ, đó là lỗ hổng nghiêm trọng — hãy báo ngay.

## 4. Ngoài phạm vi (out of scope)

- Kẻ tấn công **cầm điện thoại đã mở khoá**, thiết bị đã root, hoặc bản build debug.
- Lỗ hổng của thư viện bên thứ ba (Expo, React Native, `react-native-ble-plx`, JMRTD, Bouncy Castle…): báo cho dự án đó; nếu cần nâng phiên bản ở đây thì mở issue công khai bình thường.
- Bản xem trước web (`npm run web`) — chỉ dùng để phát triển giao diện, không dùng thật.
- Thiếu ghim chứng chỉ, thiếu chống dịch ngược, thiếu phát hiện root, thiếu mã hoá toàn bộ cơ sở dữ liệu — xem mục 5.
- Báo cáo chỉ là kết quả quét tự động, không kèm tác động thực tế.

## 5. Hạn chế đã biết (không cần báo cáo)

- **Cơ sở dữ liệu SQLite không được mã hoá.** Dữ liệu nằm trong vùng riêng của ứng dụng (`expo-sqlite`), dựa vào cơ chế sandbox và khoá màn hình của Android. Điện thoại dùng sơ tuyển phải có khoá màn hình và không cho người ngoài mượn.
- **Tệp sao lưu JSON và PDF xuất ra không được mã hoá**, do phải mở được bằng máy tính của trạm. Ai cầm tệp là đọc được hồ sơ — gửi qua kênh nội bộ, đừng gửi qua mạng xã hội.
- **Không xác thực thụ động (Passive Authentication) chip CCCD.** `modules/cccd-nfc` chỉ làm PACE (dự phòng BAC) rồi đọc DG1 và DG13; **không** đọc SOD, **không** kiểm tra chữ ký của cơ quan cấp thẻ. Dữ liệu đọc được chỉ để **điền sẵn hồ sơ**, không phải bằng chứng xác minh danh tính. DG2 (ảnh) và các nhóm sinh trắc học không được đọc.
- **Không có tài khoản, không phân quyền.** Ai mở được ứng dụng là xem được toàn bộ hồ sơ của đợt sơ tuyển.
- **iOS chưa được kiểm thử.** Mới chỉ chạy bản APK release trên Android (Samsung Galaxy Note 10, Android 12); đọc chip CCCD qua NFC là Android-only.
- **Bản APK phát hành ký bằng debug keystore** (cấu hình mặc định của React Native). Không dùng để phân phối chính thức; hãy tự tạo keystore riêng theo <https://reactnative.dev/docs/signed-apk-android>.

---

<details>
<summary><b>English summary — click to expand</b></summary>

Report privately at <https://github.com/nguyenquocanhz/SoTuyenNghiaVu/security/advisories/new> (Security → Report a vulnerability). Do not open a public issue, and do not open a public PR with the fix before it is patched. **Never attach real citizen data** — no real ID numbers, names, dates of birth, exported forms or backups; use fake data.

The app stores sensitive personal health data of conscription candidates on the device and makes **no network calls at all**. In scope: data at rest (`src/db/`, `src/store/`), the `sotuyennghiavu://import?data=…` deep link and backup-file merge (`src/app/import.tsx`, `src/domain/merge.ts`) — especially anything that writes without the explicit confirmation step — PDF/CSV export and sharing, untrusted NFC (`modules/cccd-nfc`) and BLE input, and Android configuration. Any path that makes records leave the device without the user sharing them deliberately is a serious vulnerability.

Out of scope: an attacker holding the unlocked phone, rooted devices, debug builds, third-party library vulnerabilities (report upstream), the web preview, and the known limitations below.

Known limitations, no need to report: the SQLite database and exported backups/PDFs are not encrypted; there is no login and no per-user permissions; the CCCD chip is read without Passive Authentication (PACE/BAC, DG1 and DG13 only — never a proof of identity); iOS is untested; the release APK is signed with the default debug keystore and is not meant for official distribution.

</details>
