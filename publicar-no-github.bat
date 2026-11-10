@echo off
chcp 65001 > nul
set "GIT_PATH=%LOCALAPPDATA%\Programs\Git\cmd"
if exist "%GIT_PATH%\git.exe" (
    set "PATH=%GIT_PATH%;%PATH%"
)

echo ======================================================
echo    Sincronizar e Publicar no GitHub (Web)
echo ======================================================
echo.

git status -s
echo.

set /p MSG="Digite a mensagem da alteracao (ou Enter para 'Atualizacao do app'): "
if "%MSG%"=="" set MSG=Atualizacao do app

echo.
echo Adicionando arquivos...
git add .

echo Criando versao...
git commit -m "%MSG%"

echo.
echo Enviando para o GitHub...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo   Sucesso! As alteracoes foram enviadas para o GitHub.
    echo   O site na web sera atualizado em cerca de 1 a 2 min.
    echo ======================================================
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao enviar para o GitHub.
    echo Verifique sua conexao ou permissoes.
)

pause

