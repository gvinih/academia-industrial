@echo off
chcp 65001 > nul
set "GIT_PATH=%LOCALAPPDATA%\Programs\Git\cmd"
set "GH_PATH=%LOCALAPPDATA%\Programs\GitHub CLI\bin"
if exist "%GIT_PATH%\git.exe" set "PATH=%GIT_PATH%;%PATH%"
if exist "%GH_PATH%\gh.exe" set "PATH=%GH_PATH%;%PATH%"

echo ======================================================
echo    Academia Industrial - Publicar no GitHub / Web
echo ======================================================
echo.

git status -s
echo.

for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1

if not defined HAS_CHANGES (
    echo [INFO] Nenhuma alteracao pendente detectada no projeto.
    echo Tudo ja esta sincronizado com o GitHub!
    echo.
    pause
    exit /b 0
)

set /p MSG="Digite o que foi alterado (ou Enter para 'Atualizacao do app'): "
if "%MSG%"=="" set MSG=Atualizacao do app

echo.
echo 1/3 - Adicionando arquivos modificados...
git add .

echo 2/3 - Registrando versao...
git commit -m "%MSG%"

echo.
echo 3/3 - Enviando para o GitHub (main)...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo   [SUCESSO] Alteracoes enviadas com exito!
    echo   O GitHub Actions esta gerando o deploy agora.
    echo   Em cerca de 1 a 2 minutos seu site estara atualizado.
    echo ======================================================
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao enviar para o GitHub.
    echo Verifique sua conexao ou permissoes.
)

echo.
pause
