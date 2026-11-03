@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 优先用项目自带虚拟环境；没有就用系统 python
set "PY=python"
if exist "..\.venv\Scripts\python.exe" set "PY=..\..\.venv\Scripts\python.exe"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"

echo ============================================================
echo   Quiz Factory 数据版（FastAPI + SQLite）
echo   浏览器会自动打开 http://127.0.0.1:8800/
echo   接口文档（自动生成）：http://127.0.0.1:8800/docs
echo   关闭这个黑窗口 = 关闭服务；数据库就是目录里的 db.sqlite3
echo ============================================================
echo.

rem 首次运行先准备种子数据（data/ 里没有就自动补）
if not exist "data" (
  echo 首次运行：正在从 v1 测试库加工种子数据...
  "%PY%" prepare.py
  echo.
)

start "quiz-server" /min "%PY%" server.py
ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:8800/"

echo 已在浏览器打开。零依赖：只要电脑里有 Python 就能跑，无需安装任何包。
echo.
pause
