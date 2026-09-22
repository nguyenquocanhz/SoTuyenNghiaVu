# Đóng góp cho Sơ tuyển NVQS điện tử

Cảm ơn bạn đã quan tâm. Đóng góp có giá trị nhất là **đối chiếu dữ liệu đã số hoá với bản gốc Thông tư 105/2023/TT-BQP và Thông tư 106/2025/TT-BQP**: 207 mục bệnh tật, bảng thể lực, chỉ dẫn khám và ba biểu mẫu in đều được chép tay từ bản scan, nên một dấu phẩy sai cũng làm sai điểm của công dân.

> [!WARNING]
> Ứng dụng chỉ **gợi ý** điểm và kết luận cho Tổ sơ tuyển sức khỏe của Trạm y tế cấp xã. Mọi thay đổi chạm đến điểm, phân loại hay câu kết luận **bắt buộc dẫn nguồn** trong mô tả PR: số điều, khoản, mục, phụ lục của thông tư.

*English: see the [English summary](#english-summary) at the end.*

---

## 1. Nguyên tắc chung

| Nguyên tắc | Ý nghĩa cụ thể |
| --- | --- |
| **Không dữ liệu cá nhân thật** | Không commit số CCCD, họ tên, ngày sinh, phiếu đã in, ảnh chụp màn hình có hồ sơ thật hay tệp sao lưu thật. Trong test dùng dữ liệu giả (`001203000001`, `NGUYỄN VĂN A`). Điều này áp dụng cho cả issue và PR. |
| **Dẫn nguồn pháp lý** | Ngưỡng điểm, danh mục bệnh, bố cục biểu mẫu phải dẫn được điều/khoản/mục/phụ lục. Không suy đoán; nếu thông tư không nói thì ghi rõ là suy luận của ứng dụng. |
| **Không tự ý "cải tiến" biểu mẫu** | Phiếu Mẫu 2, Mẫu 2a, Mẫu 2k phải in ra đúng bố cục của Thông tư 106/2025/TT-BQP. Thêm cột, đổi tiêu đề, bỏ dòng ký tên đều không được. |
| **Không mạng** | Ứng dụng không gọi mạng. PR thêm bất kỳ lệnh gọi mạng nào (thống kê, cập nhật, đồng bộ đám mây) sẽ bị từ chối, trừ khi có thảo luận trước trong issue. |
| **Tiếng Việt là ngôn ngữ giao diện** | Chuỗi hiển thị viết tiếng Việt có dấu, đúng chính tả hành chính. Comment trong mã nguồn: tiếng Anh. Issue/PR: tiếng Việt hoặc tiếng Anh đều được. |

## 2. Môi trường phát triển

| Công cụ | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | 20 trở lên | CI chạy Node 20 |
| npm | đi kèm Node | dùng `npm ci` để khớp `package-lock.json` |
| JDK | 17 | cho build Android |
| Android SDK | theo Expo SDK 57 | đặt biến môi trường `ANDROID_HOME` |
| Thiết bị Android thật | có NFC nếu đụng tới CCCD, BLE nếu đụng tới cân | máy ảo **không có** NFC/Bluetooth |

Ứng dụng dùng native module (NFC, BLE, SQLite) nên **không chạy được trong Expo Go**.

```bash
git clone https://github.com/nguyenquocanhz/SoTuyenNghiaVu.git
cd SoTuyenNghiaVu
npm ci
```

> Thư mục `android/`, `ios/`, `.expo/` và `expo-env.d.ts` được sinh tự động và nằm trong `.gitignore` — đừng commit. Mọi cấu hình native đặt trong [`app.json`](app.json) rồi chạy lại `npx expo prebuild --platform android`.

## 3. Kiểm tra bắt buộc trước khi mở PR

```bash
npm run typecheck
npm test
```

Cả hai phải sạch (CI chạy đúng hai lệnh này trên Node 20). Thêm test cho mọi thay đổi về điểm, phân loại hay nội dung biểu mẫu: xem `src/domain/__tests__/`, `src/standards/__tests__/`, `src/reports/__tests__/`.

Build APK để thử trên máy thật:

```bash
npx expo prebuild --platform android
npm run apk
```

APK nằm ở `android/app/build/outputs/apk/release/app-release.apk`. Bản này ký bằng debug keystore — chỉ để thử, không để phân phối.

## 4. Bố cục mã nguồn

| Thư mục | Nội dung |
| --- | --- |
| `src/standards/` | Dữ liệu từ thông tư: `diseases.ts` (Mục II, 207 mục), `exemptions.ts` (Mục III), `adminUnits.ts` + `stations.ts` (danh mục đơn vị hành chính, tên trạm y tế) |
| `src/domain/` | Tính điểm và kết luận: `physique.ts` (Mục I), `vision.ts`, `vitals.ts`, `screening.ts`, `merge.ts`, `inputs.ts` |
| `src/reports/` | Sinh HTML/PDF: `forms.ts` (Mẫu 2, 2a, 2k), `html.ts`, `fonts.ts` (font Tinos nhúng), `output.ts` (in, chia sẻ) |
| `src/app/` | Màn hình (expo-router) |
| `src/db/`, `src/store/` | SQLite và zustand |
| `src/ble/`, `modules/cccd-nfc/` | Cân Bluetooth và đọc chip CCCD |

## 5. Sửa một mục trong danh mục bệnh tật (thường gặp nhất)

1. Mở `src/standards/diseases.ts`, tìm theo số mục (giữ nguyên cách đánh số của thông tư, kể cả số trùng hoặc thiếu).
2. Giữ **nguyên văn** ô "Điểm" của bản gốc (`4`, `3T`, `4-5`, `5, 6`, "Cho điểm theo mục 1.1…") — phần diễn giải do `src/domain/` xử lý, không sửa dữ liệu cho "gọn".
3. Thêm hoặc sửa test trong `src/standards/__tests__/catalog.test.ts`.
4. Trong PR ghi rõ: số mục, trang/ảnh của bản scan hoặc trích dẫn văn bản, nội dung cũ và nội dung đúng.

## 6. Quy ước commit và Pull Request

- Commit theo kiểu Conventional Commits: `fix(standards): sửa điểm mục 78 Mục II theo Phụ lục I`.
- Một PR làm một việc. PR chạm tới điểm/kết luận phải nêu: căn cứ pháp lý, ảnh hưởng tới phiếu đã in, test đã thêm.
- Nếu tính năng chưa thử trên máy thật thì ghi rõ trong PR.

## 7. Báo lỗi

Dùng mẫu issue có sẵn:

- **Lỗi ứng dụng** — mô tả, các bước tái hiện, thiết bị, phiên bản Android.
- **Sai lệch so với thông tư** — mục nào, ứng dụng đang hiển thị gì, thông tư viết gì, căn cứ.

Nhớ che dữ liệu thật trước khi dán ảnh chụp màn hình hay nội dung phiếu. Lỗ hổng bảo mật thì theo [SECURITY.md](SECURITY.md), **không** mở issue công khai.

## 8. Giấy phép cho phần đóng góp

Khi gửi pull request, bạn đồng ý cấp phép phần đóng góp theo [Apache License 2.0](LICENSE), giống phần còn lại của dự án. Xem [NOTICE](NOTICE) về thành phần bên thứ ba và về việc văn bản quy phạm pháp luật không thuộc phạm vi bảo hộ quyền tác giả.

---

## English summary

The most useful contribution is checking the digitised tables against the original circulars (Thông tư 105/2023/TT-BQP and 106/2025/TT-BQP): every disease entry, score threshold and printed form was transcribed by hand from scans.

Rules: never commit real personal data (use fake IDs such as `001203000001`); any change to scoring, classification or form layout must cite the article/appendix it comes from; the printed forms must match the official layout exactly; the app makes no network calls and PRs that add any are rejected; UI strings are Vietnamese, code comments are English.

Setup: Node 20, JDK 17, Android SDK, a real Android device (no Expo Go — the app uses native modules). `npm ci`, then `npm run typecheck` and `npm test` must both pass before opening a PR; CI runs exactly those. Build an APK with `npx expo prebuild --platform android && npm run apk` (debug-keystore signed, for testing only).

Report bugs and transcription errors with the issue templates; report vulnerabilities privately per [SECURITY.md](SECURITY.md). Contributions are licensed under [Apache-2.0](LICENSE).
