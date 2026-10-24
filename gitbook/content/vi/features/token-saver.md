# Tiết kiệm Token (Token Saver)

Các công cụ agent lập trình đốt 30–50% ngân sách prompt cho nội dung boilerplate: đầu ra công cụ dài dằng dặc (`git diff`, `grep`, log test), kết quả công cụ trùng lặp, và lịch sử cũ bị phát lại mỗi lượt. **Token Saver** của 9Router cắt/nén phần chết trọng này *trước khi* yêu cầu rời máy bạn — minh bạch theo từng saver, kèm bảng điểm tiết kiệm trực tiếp.

Mọi saver đều vô hại với khả năng ra quyết định của mô hình: lỗi và chi tiết quan trọng được giữ nguyên; chỉ phần rườm rà thừa bị nén hoặc loại bỏ.

## Các saver

| Saver | Tác dụng | Mặc định |
|---|---|---|
| **Bộ lọc RTK** | Nhận diện loại đầu ra công cụ (git diff/status, grep, find, ls, tree, log) và nén bằng bộ lọc theo loại, không mất dữ liệu | Bật |
| **Dedup kết quả công cụ** | Kết quả trùng byte tuyệt đối trong cùng yêu cầu trở thành tham chiếu một dòng (`duplicate of tool result #N`) | Bật |
| **History GC** | Kết quả công cụ cũ hơn N lượt người dùng gần nhất được nén thành bản tóm tắt (đầu + kích thước + fingerprint + gợi ý chạy lại) | Tắt (`historyGcEnabled`, số lượt giữ cấu hình được, mặc định 6) |
| **Bộ lọc test-runner** | Nén đầu ra vitest/jest/pytest/go/mocha/TAP — giữ lỗi + tóm tắt, lược bức tường test pass | Tự nhận diện |
| **Cache phản hồi** | Cache theo yêu cầu chính xác cho chat không stream (LRU + TTL); hit trả kèm `x-9r-cache: hit` | Tắt (`responseCacheEnabled`) |
| **System prompt tùy chỉnh** | Chèn system prompt của bạn across các dạng yêu cầu OpenAI/Claude/Gemini/Kiro | Tắt |
| **Headroom** | Nén ngữ cảnh qua dịch vụ Headroom cục bộ (đầu ra công cụ, văn bản dài; dạng Gemini/Responses/Claude gốc) | Tắt |
| **Caveman** | Nén *đầu ra* LLM trước khi nó quay lại hội thoại | Tắt |
| **Ponytail** | Chế độ "dev senior lười" — tinh gọn lịch sử trợ lý dài dòng | Tắt |
| **Pxpipe** | Biến ngữ cảnh văn bản lớn thành ảnh tối ưu (mô hình thị giác) | Tắt |

## Bật/tắt

Dashboard → **Token Saver**: công tắc cho dedup kết quả công cụ, History GC (kèm ô số lượt giữ) và cache phản hồi.

Qua CLI trên DB cục bộ:

```bash
node scripts/enable-token-savers.mjs            # RTK + dedup + History GC
node scripts/enable-token-savers.mjs --response-cache --smart-combo
node scripts/enable-token-savers.mjs --revert   # về mặc định
```

## Bảng điểm

Dashboard → **Usage → Token Saver Scoreboard** hiển thị trực tiếp số hit, byte tiết kiệm được và thống kê cache theo từng saver từ khi khởi động tiến trình (`GET /api/usage/savers`, POST để reset). Tổng quan Usage còn hiển thị **Cache Hit Rate** — tỷ lệ token đầu vào được phục vụ từ prompt cache của nhà cung cấp.

## Bỏ qua

Gửi kèm header `X-9Router-Token-Saver: off` trên bất kỳ yêu cầu chat nào để gửi nguyên văn.
