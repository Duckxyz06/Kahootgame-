# QuizVN – Real-time Vietnamese Quiz Game

QuizVN là ứng dụng độc lập dành cho người điều khiển (host) và tối đa 200 người chơi trong một phòng. Giao diện tiếng Việt, không sử dụng hình ảnh, logo hay bảng màu thương hiệu của nền tảng khác.

## Cấu trúc

- `server/index.js`: Express, Socket.IO, xác thực host, phòng PIN, điểm và bảng xếp hạng
- `server/store.js`: quản lý bộ đề trong PostgreSQL, dự phòng RAM khi chưa cấu hình database
- `server/validation.js`: kiểm tra câu hỏi và biệt danh
- `public/`: giao diện responsive cho host, người chơi và trình soạn đề
- `questions/sample.json`: 10 câu hỏi mẫu
- `database/schema.sql`: schema PostgreSQL
- `loadtest.js`: giả lập tối đa 200 người tham gia

## Chạy máy cá nhân

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env
# Sửa HOST_PASSWORD trong .env; các biến môi trường cần được export hoặc chạy bằng --env-file
node --env-file=.env server/index.js
```

Mở http://localhost:3000 để chơi, http://localhost:3000/host để làm host và http://localhost:3000/editor để soạn bộ đề. Mật khẩu demo local mặc định là `admin` nếu chưa đặt `HOST_PASSWORD` (KHÔNG dùng mặc định khi deploy).

## Tạo database miễn phí hoặc trả phí (khuyên dùng Neon PostgreSQL)

1. Truy cập https://neon.tech, đăng ký, chọn **New Project**, khu vực gần người chơi (nếu có Singapore thì chọn).
2. Chọn **Connection Details** và sao chép **Postgres connection string** có dạng `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`.
3. Vào Render > Web Service > Environment, thêm `DATABASE_URL` và dán connection string. Không đưa mật khẩu này lên GitHub.
4. Server tự tạo bảng `quizzes` khi khởi động. Có thể chạy nội dung `database/schema.sql` trong SQL editor của Neon để tạo thủ công.
5. Truy cập `/host`, nhập mật khẩu, vào **Soạn câu hỏi**, tạo bộ đề và bấm **Lưu bộ đề lên server**. Khi DATABASE_URL có giá trị, đề sẽ được lưu vào Postgres.

Chú ý: chức năng **Lưu** trong editor tạo một bản bộ đề mới, chưa hỗ trợ ghi đè bản cũ. Người chơi và điểm số hiện vẫn lưu RAM, sẽ mất khi máy chủ khởi động lại. Khi chưa thiết lập DATABASE_URL, bộ đề mới tạo cũng chỉ nằm RAM và sẽ mất khi khởi động lại.

## Deploy Render

1. Push repository này lên GitHub.
2. Đăng nhập https://render.com > New > Web Service > Connect GitHub repo `Duckxyz06/Kahootgame-`.
3. Chọn **Docker** runtime (Render có thể đọc `render.yaml` nếu dùng Blueprint). Chạy **1 instance** để giữ Socket.IO rooms trong RAM.
4. Thêm biến **HOST_PASSWORD** (mật khẩu mạnh, tối thiểu 16 ký tự ngẫu nhiên), **DATABASE_URL** (PostgreSQL) và tùy chọn **PUBLIC_URL** (URL website Render, dùng cho QR).
5. Deploy và kiểm tra `https://your-app.onrender.com/health`; trả JSON `database: postgres` nghĩa là kết nối cơ sở dữ liệu đã hoạt động.
6. Mở `/host` trên laptop/máy chiếu, tạo phòng. Người chơi vào tên miền gốc trên điện thoại, nhập PIN và biệt danh.

Không triển khai bằng GitHub Pages: Socket.IO cần Node.js server. Gói host miễn phí có thể ngủ hoặc không phù hợp 200 người; cân nhắc gói chạy liên tục và kiểm thử thực tế.

## Luồng Socket.IO

`host:auth` (mật khẩu -> host session token), `quiz:list/get/save`, `host:create` (bộ đề -> PIN và room token), `p:join` (PIN + nickname hoặc playerId), `host:start` -> `q:show`, `p:answer` -> `h:progress` (throttle 500ms), `h:result` / `p:result`, `host:board` -> `h:board`, `host:next` -> câu tiếp; `h:over` và CSV kết quả.

## Kiểm thử

```bash
npm test
PIN=123456 URL=http://localhost:3000 BOTS=200 npm run loadtest
```

Tạo phòng trước; khi bot vào đủ, host bắt đầu và chạy qua vài câu. Kịch bản chỉ đo thời gian callback trên máy khách và độ trễ ack, không phải benchmark đo one-way server-to-client (cần đồng bộ đồng hồ để đo chính xác). **Chưa khẳng định đã qua load test 200 kết nối trên Render**.

## Bảo mật và giới hạn

Host được bảo vệ bằng mật khẩu môi trường, token ngẫu nhiên; đầu vào được validate và mỗi người chỉ trả lời 1 lần/câu. Client lưu `playerId` để kết nối lại. Không sử dụng dịch vụ lưu ảnh: ô ảnh chấp nhận URL HTTPS, có thể dùng dịch vụ lưu ảnh độc lập. Database chỉ lưu bộ đề; không lưu bí mật trong repository. Bản đầu chưa có nhiều tài khoản host, không có database session, không có hệ thống lưu lịch sử điểm lâu dài. 
