#!/usr/bin/bash
#
/root/ourlife-app/kill.sh
node server.js &
npx serve --listen 8080 & 
