# Coddy Helper

Tiện ích Chrome Manifest V3 hỗ trợ các dạng trắc nghiệm, viết code, chọn dòng code và điền khuyết.

## Dùng với AI

### API tương thích OpenAI

Trong popup chọn **API tương thích OpenAI**, đặt URL API, model và API key. Dùng được với dịch vụ cung cấp giao thức Chat Completions tương thích OpenAI. Khi bấm **Giải qua API**, Chrome sẽ hỏi quyền kết nối tới host API đã nhập. Mặc định là OpenAI: `https://api.openai.com/v1`.

### Chatbot bất kỳ

Chọn **Chatbot bất kỳ (thủ công)**, bấm **Tạo prompt từ tab Coddy**, sao chép prompt sang chatbot bạn muốn dùng, rồi dán JSON nó trả lời vào tiện ích và chọn **Điền đáp án vào Coddy**. Cách này dùng được với chatbot bất kỳ, kể cả dịch vụ chỉ có giao diện web hoặc API khác định dạng.

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
2. Lần đầu, chọn **Load unpacked** và chọn thư mục `coddy-helper`. Nếu đã cài bản trước, bấm nút **Reload** trên thẻ Coddy Helper.
3. Tải lại tab Coddy nếu tab đã mở trước đó.
4. Mở bài tập và dùng popup.

Mặc định **Tự nộp sau khi điền/chọn** bật. Có thể tắt trong popup để xem lại đáp án trước. API key được lưu trong `chrome.storage.local` của Chrome. Ở chế độ API, nội dung bài, lựa chọn và code được gửi tới host API bạn đặt. Ở chế độ thủ công, tiện ích chỉ tạo prompt; bạn tự quyết định chatbot nào nhận nội dung.

## Giới hạn

Việc đọc và điền phụ thuộc cấu trúc trang Coddy, DOM của dạng câu hỏi và editor trên trang. Hỗ trợ code tốt nhất với Monaco hoặc Ace. Mô hình AI có thể sai; hãy kiểm tra câu trả lời, đặc biệt khi bật tự nộp.
