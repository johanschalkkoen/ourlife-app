#!/usr/bin/bash
#
pm2 start $(which http-server) --name ourlife-app-web -- -p 8080 -d /root/ourlife-app --watch --watch-delay 1000
pm2 start --name ourlife-app-api-server /root/ourlife-app/server.js --watch --watch-delay 1000
