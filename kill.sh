#!/usr/bin/bash
#
pm2 delete  ourlife-app-api-server ourlife-app-web
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl restart nginx 
