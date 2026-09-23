#!/bin/bash
# Патч AndroidManifest, MainActivity, регистрация нативных плагинов и Activity
set -e

MANIFEST="android/app/src/main/AndroidManifest.xml"
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.java" | head -1)

echo "🔧 Патчим AndroidManifest.xml..."
echo "   Manifest: $MANIFEST"
echo "   MainActivity: $MAIN_ACTIVITY"

# === 1. Разрешения: микрофон + вибрация ===
if ! grep -q "RECORD_AUDIO" "$MANIFEST"; then
  sed -i 's|<application|<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n\n    <application|' "$MANIFEST"
  echo "✅ Добавлены RECORD_AUDIO + MODIFY_AUDIO_SETTINGS + VIBRATE"
fi

# === 2. allowBackup=false ===
sed -i 's|android:allowBackup="true"|android:allowBackup="false"|' "$MANIFEST"
echo "✅ allowBackup=false"

# === 3. FishGameActivity в манифест ===
if ! grep -q "FishGameActivity" "$MANIFEST"; then
  sed -i 's|</application>|    <activity\n        android:name="ru.geroy_skazki.app.FishGameActivity"\n        android:screenOrientation="portrait"\n        android:exported="false"\n        android:theme="@android:style/Theme.NoTitleBar.Fullscreen" />\n    </application>|' "$MANIFEST"
  echo "✅ FishGameActivity добавлен в AndroidManifest.xml"
else
  echo "✅ FishGameActivity уже в манифесте"
fi

# === 4. Патч MainActivity для микрофона ===
if [ -n "$MAIN_ACTIVITY" ]; then
  cat > /tmp/patch_main.py << 'PYEOF'
import sys
file_path = sys.argv[1]
with open(file_path, 'r') as f:
    content = f.read()

if 'import android.webkit.PermissionRequest' not in content:
    content = content.replace(
        'import android.webkit.WebView;',
        'import android.webkit.WebView;\nimport android.webkit.PermissionRequest;\nimport android.webkit.WebChromeClient;'
    )

if 'onPermissionRequest' not in content:
    import re
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
print("✅ MainActivity patched (mic)")
PYEOF
  python3 /tmp/patch_main.py "$MAIN_ACTIVITY"
fi

# === 5. Копируем нативные Kotlin-файлы (fish game) ===
echo ""
echo "=== Копируем нативные Kotlin-файлы (fish game) ==="
NATIVE_DIR="android-native"
JAVA_DIR="android/app/src/main/java/ru/geroy_skazki/app"

if [ -d "$NATIVE_DIR" ]; then
  mkdir -p "$JAVA_DIR"
  cp "$NATIVE_DIR/FishGameActivity.kt" "$JAVA_DIR/"
  cp "$NATIVE_DIR/FishGameView.kt" "$JAVA_DIR/"
  cp "$NATIVE_DIR/GamePlugin.kt" "$JAVA_DIR/"
  echo "✅ Скопированы .kt файлы:"
  ls -la "$JAVA_DIR/"
else
  echo "⚠️ Не найдена папка $NATIVE_DIR — пропускаем копирование .kt"
fi

# === 6. Финальная проверка ===
echo ""
echo "=== ФИНАЛЬНАЯ ПРОВЕРКА ==="
echo "Permissions:"
grep -E "RECORD_AUDIO|MODIFY_AUDIO|VIBRATE" "$MANIFEST" || echo "  ❌ НЕ НАЙДЕНО"
echo ""
echo "MainActivity: onPermissionRequest"
grep -c "onPermissionRequest" "$MAIN_ACTIVITY" || echo "  ❌ НЕ НАЙДЕНО"
echo ""
echo "FishGameActivity в манифесте:"
grep -c "FishGameActivity" "$MANIFEST" || echo "  ❌ НЕ НАЙДЕН"
echo ""
echo "Kotlin-файлы в JAVA_DIR:"
ls -la "$JAVA_DIR" 2>/dev/null || echo "  ❌ Папки нет"
