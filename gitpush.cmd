call git add .
call git commit -m "%*"
call git push origin main
date /T "%*" >> gitPushed.txt
echo "%*" >> gitPushed.txt