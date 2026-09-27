@echo off
cd /d "%~dp0"
echo ローカル確認: http://127.0.0.1:8000/
echo 終了するときは、この画面で Ctrl+C を押してください。
python -m http.server 8000 --bind 127.0.0.1
pause
