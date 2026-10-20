# QuizVN

Ứng dụng quiz thời gian thực dành cho tối đa 200 người chơi, host điều khiển bằng Socket.IO, giao diện React/Vite và Node.js/Express.

## Mã nguồn
Bản mã nguồn đầy đủ hiện được cung cấp kèm tệp `QuizVN-full-source.zip` trong cuộc trò chuyện. Giải nén vào thư mục dự án để chạy.

## Chạy local
```bash
npm install
npm --prefix client install
npm run build:client
HOST_PASSWORD='change-this-password' npm start
```
Host: `/host` · Người chơi: `/` · Soạn câu hỏi: `/editor`.

## Deploy
Dockerfile trong bản ZIP, một instance duy nhất vì state nằm trong RAM. Biến môi trường bắt buộc: `HOST_PASSWORD`. Chưa xác minh khả năng chịu tải 200 người trên hạ tầng triển khai.

## Socket.IO
`host:auth`, `host:create`, `p:join`, `host:start`, `q:show`, `h:q`, `p:answer`, `h:progress`, `h:result`, `p:result`, `host:showBoard`, `h:board`, `host:next`, `host:kick`, `host:resume`, `h:over`, `p:final`.
