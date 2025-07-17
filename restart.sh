#!/usr/bin/bash
#
for i in `ps aux | grep node | grep -v grep | awk '{print $2}' ; ` ; do kill -9 $i ; done
sleep 1
node server.js &
npx serve --listen 80 & 
