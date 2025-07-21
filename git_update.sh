#!/usr/bin/bash
#
read -p "What are we chaning in the code?: " name

git pull
git add *
gt add .
git commit -m "$name"
git push
git status
