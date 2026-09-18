#!/bin/bash
# Патч AndroidManifest и MainActivity для микрофона

set -e

MANIFEST="android/app/src/main/AndroidManifest.xml"
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.java" | head -1)

echo "🔧 Патчим AndroidManifest.xml..."
echo "   Manifest: $MANIFEST"
echo "   MainActivity: $MAIN_ACTIVITY"

# 1. Разрешения на микрофон + allowBackup=false
if ! grep -q "RECORD_AUDIO" "$MANIFEST"; then
  # Вставляем permissions перед <application
  sed -i 's|<application|<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n\n    <application|' "$MANIFEST"
  echo "✅ Добавлены RECORD_AUDIO + MODIFY_AUDIO_SETTINGS"
fi

# 2. allowBackup=false для безопасности
sed -i 's|android:allowBackup="true"|android:allowBackup="false"|' "$MANIFEST"
echo "✅ allowBackup=false"

# 3. Патч MainActivity для разрешения микрофона в WebView
if [ -n "$MAIN_ACTIVITY" ]; then
  cat > /tmp/patch_main.py << 'PYEOF'
import sys
import re

file_path = sys.argv[1]

with open(file_path, 'r') as f:
    content = f.read()

# Добавляем импорты
if 'import android.webkit.PermissionRequest' not in content:
    content = content.replace(
        'import android.webkit.WebView;',
        'import android.webkit.WebView;\nimport android.webkit.PermissionRequest;\nimport android.webkit.WebChromeClient;'
    )

# Добавляем WebChromeClient после bridge init
if 'onPermissionRequest' not in content:
    # Ищем this.init или bridge init
    pattern = r'(this\.bridge\s*=\s*new\s+BridgeActivity\.Bridge\([^)]+\);|super\.onCreate\([^)]+\);)'
    match = re.search(pattern, content)
    
    if match:
        insertion = match.group(0) + '''

        // Grant mic permission to WebView
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });'''
        content = content.replace(match.group(0), insertion, 1)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ MainActivity patched")
PYEOF

  python3 /tmp/patch_main.py "$MAIN_ACTIVITY"
fi

echo ""
echo "=== ПРОВЕРКА ==="
echo "Permissions в манифесте:"
grep -E "RECORD_AUDIO|MODIFY_AUDIO" "$MANIFEST" || echo "  ❌ НЕ НАЙДЕНО"
echo ""
echo "onPermissionRequest в MainActivity:"
grep -c "onPermissionRequest" "$MAIN_ACTIVITY" || echo "  ❌ НЕ НАЙДЕНО"