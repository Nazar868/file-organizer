mkdir announcement-board
cd announcement-board

npm init -y

npm install express ejs prisma @prisma/client

npx prisma migrate dev --name init

npm install
npx prisma migrate dev --name init
node app.js

npm install express ejs prisma @prisma/client
