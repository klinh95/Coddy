# Coddy Helper

Tiện ích Chrome Manifest V3 hỗ trợ trắc nghiệm, viết code, chọn dòng code và điền khuyết.

## Dùng với Gemini

Trong popup chọn **Google Gemini**, dán Gemini API key và tên model. Không cần điền địa chỉ API. Tiện ích gọi Gemini Interactions API bằng API key và model đã nhập, thử lại khi gặp lỗi mạng/giới hạn tạm thời, và có đường lui sang GenerateContent khi Interactions API không khả dụng. API key được lưu riêng theo nhà cung cấp để tránh gửi nhầm key.

Nếu Gemini đang được chọn nhưng lỗi lại ghi **OpenAI API**, tiện ích cũ vẫn đang chạy. Mở `edge://extensions` (Edge) hoặc `chrome://extensions` (Chrome), bấm **Reload** trên Coddy Helper, rồi tải lại tab Coddy. Popup của bản mới hiển thị `v1.3.0`. Google mô tả endpoint Interactions và định dạng này trong [tài liệu Gemini](https://ai.google.dev/gemini-api/docs/interactions-overview).

## Dùng với AI khác

- Với dịch vụ có API tương thích OpenAI Chat Completions: chọn **OpenAI / API tương thích**, nhập endpoint, API key và model.
- Với dịch vụ API khác định dạng hoặc chatbot chỉ có giao diện web: chọn **Chatbot bất kỳ (thủ công)**, tạo prompt, sao chép sang AI, rồi dán JSON câu trả lời về Coddy Helper.

Mỗi nhà cung cấp dùng endpoint và định dạng API riêng. Chỉ có thể dùng API key + model mà không cần endpoint khi nhà cung cấp đã có adapter tích hợp (hiện có Gemini); các API khác cần adapter hoặc endpoint tương thích.

JSON cần có `type` là `choice`, `code`, `text`, `lines` hoặc `blanks`. Ví dụ chọn dòng:

```json
{"type":"lines","lineNumbers":[2],"answer":"2","explanation":"Dòng 2 gán giá trị mới cho phần tử mảng."}
```

Ví dụ điền khuyết:

```json
{"type":"blanks","blanks":[{"index":1,"answer":"substring"},{"index":2,"answer":"7"},{"index":3,"answer":"12"}],"explanation":"substring dùng chỉ số bắt đầu và kết thúc."}
```

## Cài đặt hoặc cập nhật

1. Mở `chrome://extensions` và bật **Developer mode**.
2. Lần đầu, chọn **Load unpacked** và chọn thư mục `coddy-helper`. Nếu đã cài bản trước, bấm **Reload** trên thẻ Coddy Helper.
3. Tải lại tab Coddy nếu tab đã mở trước đó.
4. Mở bài tập và dùng popup.

Mặc định **Tự nộp sau khi điền/chọn** bật. Có thể tắt để xem lại đáp án trước. API key được lưu trong `chrome.storage.local` của Chrome. Chế độ API gửi đề bài và code tới nhà cung cấp đã chọn. Chế độ chatbot thủ công chỉ tạo prompt để bạn tự quyết định chatbot nhận nội dung.

## Giới hạn

Việc đọc và điền phụ thuộc cấu trúc trang Coddy và editor trên trang. Hỗ trợ code tốt nhất với Monaco hoặc Ace. Mô hình AI có thể sai; hãy kiểm tra lời giải, đặc biệt khi bật tự nộp.
