#!/usr/bin/bash
#
git pull
pm2 delete all 
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
systemctl stop --now  nginx
