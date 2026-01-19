@echo off
findstr /n "submitDailyLog" d:\student\index.html > found_submit.txt
findstr /n "dailyLogModal.innerHTML" d:\student\index.html >> found_submit.txt
findstr /n "saveDailyLog" d:\student\index.html >> found_submit.txt
findstr /n "setupModals" d:\student\index.html >> found_submit.txt
