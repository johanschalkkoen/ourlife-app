#!/usr/bin/bash
#
cd /root/ourlife-app/
git pull
pm2 delete ourlife-app-api-server ourlife-app-web
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl stop --now  nginx
