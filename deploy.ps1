# deploy.ps1 — run from project root: .\deploy.ps1
# Stages all files, commits with v0.9 message, pushes to trigger Vercel

$ErrorActionPreference = "Stop"

Write-Host "Staging all changes..." -ForegroundColor Cyan
git add -A

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m "feat: v0.7.1-v0.9 streaming, blind arena, history, share, templates, analytics"

Write-Host "Pushing to origin/main..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "Done! Vercel will auto-deploy from main." -ForegroundColor Green
Write-Host "Track at: https://vercel.com/bellial-s-projects/new-era-ai-platform" -ForegroundColor Green
