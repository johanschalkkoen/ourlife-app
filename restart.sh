#!/usr/bin/bash
cd /var/www/ourlife-app/
git pull
npm install
pm2 stop ourlife-app-api-server
systemctl restart nginx
sleep 1
export NODE_NO_WARNINGS=1
pm2 start --name ourlife-app-api-server /var/www/ourlife-app/server.js --watch --watch-delay 1000 -- --port 3000
pm2 save
