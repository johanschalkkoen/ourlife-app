#!/usr/bin/bash
#
git pull
pm2 delete ourlife-app-api-server ourlife-app-web
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl restart nginx
sleep 1
sleep 1
npm cache clean --force
#
pm2 start $(which http-server) --name ourlife-app-web -- -p 8080 -d . 
pm2 start --name ourlife-app-api-server server.js 
