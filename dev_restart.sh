#!/usr/bin/bash
#
git pull
pm2 delete ourlife-run-place-app-web
pm2 delete ourlife-run-place-app-api-server
#for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl reload nginx
sleep 1
sleep 1
npm cache clean --force
#
pm2 start $(which http-server) --name ourlife-run-place-app-web -- -p 8081 -d . 
pm2 start --name ourlife-run-place-app-api-server server.js 
