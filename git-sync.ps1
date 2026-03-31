param(
    [string]$message = "Automated sync: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
)

try {
    Write-Host "Syncing to GitHub..." -ForegroundColor Cyan
    git add .
    git commit -m "$message" --allow-empty
    git push origin master
    Write-Host "Successfully synced to GitHub!" -ForegroundColor Green
} catch {
    Write-Error "Failed to sync to GitHub: $_"
}
