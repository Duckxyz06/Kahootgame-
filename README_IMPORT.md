# Import DOCX/PDF – QuizVN

Vào **/editor** và đăng nhập host; chọn **Nhập DOCX/PDF** để đọc câu hỏi. Trình nhập nhận văn bản trong DOCX và PDF có lớp chữ, không hỗ trợ OCR cho PDF scan dạng ảnh. Tệp giới hạn 8 MB. Vui lòng rà soát câu và đáp án trước khi bấm **Lưu bộ đề lên server**.

Định dạng ví dụ:

```text
Câu 1: Thủ đô Việt Nam là gì?
A. Hà Nội
B. Huế
C. Đà Nẵng
D. Hải Phòng
Đáp án: A

Câu 2: 2 + 2 bằng bao nhiêu?
A. 3
B. 4
Đáp án: B
```

Hệ thống không tự phán đoán câu trả lời đúng. Nếu không tìm thấy dòng đáp án, chương trình cảnh báo cần xác minh đáp án. Chọn câu đúng trong trình soạn trước khi lưu. Nếu Render đã triển khai, push mới sẽ kích hoạt auto-deploy (khi bật tính năng này). Hệ thống tải tài liệu lên server để xử lý trong bộ nhớ, không chủ động lưu bản PDF/DOCX gốc vào database.
