@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python est introuvable. Installez Python 3.10+ depuis https://www.python.org/downloads/
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creation de lenvironnement virtuel...
  python -m venv .venv
)
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Echec de linstallation des dependances.
  pause
  exit /b 1
)

python generate.py %*
if errorlevel 1 (
  echo La generation a echoue. Consultez les messages ci-dessus.
) else (
  echo.
  echo Video : %CD%\output\video_finale_tiktok.mp4
  start "" "%CD%\output"
)
pause
