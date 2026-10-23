# Coddy Helper

Tiện ích Chrome Manifest V3 để đọc bài tập đang mở trên Coddy, gửi đề bài tới OpenAI API, rồi điền phương án trắc nghiệm / code / câu trả lời vào trang. Tùy chọn **Tự nộp sau khi điền** được bật mặc định; có thể tắt trong popup.

## Cài đặt

1. Giải nén hoặc giữ nguyên thư mục này.
2. Mở `chrome://extensions` trên Chrome.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục `coddy-helper` này.
5. Nếu tab Coddy đã mở trước đó, tải lại tab một lần.
6. Mở một bài tập trên `coddy.tech`, bấm biểu tượng tiện ích, nhập OpenAI API key và model, rồi chọn **Giải bài trên tab Coddy**.

Mặc định model là `gpt-6-astra`; có thể sửa theo model được bật cho API key của bạn. API key được lưu trong `chrome.storage.local` của Chrome. Không đưa key vào file mã nguồn.

## Dữ liệu và giới hạn

Khi bấm giải, tiện ích gửi tiêu đề trang, URL, nội dung văn bản đang hiển thị, các lựa chọn tìm thấy và nội dung editor tới OpenAI API. Không có dữ liệu nào được gửi khi chỉ mở popup. Hãy chỉ dùng API key bạn kiểm soát.

Tiện ích hỗ trợ tốt nhất trang Coddy có DOM đọc được và editor Monaco hoặc Ace. Nếu Coddy thay đổi cấu trúc trang hoặc editor, có thể cần cập nhật bộ nhận diện. Model có thể sai; khi tắt nộp tự động, tiện ích chỉ điền lời giải để bạn xem lại.
