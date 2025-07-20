#!/usr/bin/bash
#
cd /root/ourlife-app/
git pull
pm2 delete ourlife-app-api-server ourlife-app-web
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl restart nginx
sleep 1
#
pm2 start $(which http-server) --name ourlife-app-web -- -p 8080 -d /root/ourlife-app --watch --watch-delay 1000
pm2 start --name ourlife-app-api-server /root/ourlife-app/server.js --watch --watch-delay 1000
