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

  # === Подключаем Kotlin plugin к build.gradle ===
  echo ""
  echo "=== Подключаем Kotlin plugin ==="
  BUILD_GRADLE_APP="android/app/build.gradle"
  BUILD_GRADLE_ROOT="android/build.gradle"

  if [ -f "$BUILD_GRADLE_APP" ]; then
    if grep -q "kotlin-android" "$BUILD_GRADLE_APP"; then
      echo "✅ Kotlin plugin уже в app/build.gradle"
    else
      # Добавляем kotlin-android plugin после com.android.application
      sed -i "s|apply plugin: 'com.android.application'|apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'|" "$BUILD_GRADLE_APP"

      # Добавляем kotlin-stdlib в dependencies
      if grep -q "^dependencies {" "$BUILD_GRADLE_APP"; then
        sed -i "/^dependencies {/a\    implementation 'org.jetbrains.kotlin:kotlin-stdlib:1.9.24'" "$BUILD_GRADLE_APP"
      fi

      echo "✅ Kotlin plugin добавлен в app/build.gradle"
    fi
  else
    echo "❌ Не нашли $BUILD_GRADLE_APP"
  fi

  # Патчим root build.gradle — добавляем kotlin classpath
  if [ -f "$BUILD_GRADLE_ROOT" ]; then
    if grep -q "kotlin-gradle-plugin" "$BUILD_GRADLE_ROOT"; then
      echo "✅ kotlin-gradle-plugin уже в root/build.gradle"
    else
      # Добавляем classpath kotlin после com.android.tools.build:gradle
      sed -i "s|classpath 'com.android.tools.build:gradle:[^']*'|&\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24'|" "$BUILD_GRADLE_ROOT"
      echo "✅ kotlin-gradle-plugin добавлен в root/build.gradle"
    fi
  fi

  # Проверка
  echo ""
  echo "=== Проверка Kotlin plugin ==="
  grep -n "kotlin" "$BUILD_GRADLE_APP" || echo "  ❌ НЕ НАЙДЕНО в app/build.gradle"
  grep -n "kotlin-gradle-plugin" "$BUILD_GRADLE_ROOT" || echo "  ❌ НЕ НАЙДЕНО в root/build.gradle"

  # === Регистрируем GamePlugin в MainActivity ===
  echo ""
  echo "=== Регистрируем GamePlugin в MainActivity ==="
  if [ -n "$MAIN_ACTIVITY" ]; then
    if grep -q "registerPlugin(GamePlugin" "$MAIN_ACTIVITY"; then
      echo "✅ GamePlugin уже зарегистрирован"
    else
      # Патчим через Python — добавляем registerPlugin(GamePlugin.class);
      cat > /tmp/patch_gp.py << 'PYEOF'
import sys

file_path = sys.argv[1]

with open(file_path, 'r') as f:
    content = f.read()

# Импорт: добавляем com.getcapacitor.Plugin и GamePlugin (если нужно)
if 'registerPlugin(GamePlugin.class)' not in content:
    # Ищем onCreate
    if 'public void onCreate' in content or 'protected void onCreate' in content:
        # Вставляем registerPlugin в начало onCreate (после super.onCreate)
        content = content.replace(
            'super.onCreate(savedInstanceState);',
            'super.onCreate(savedInstanceState);\n        registerPlugin(GamePlugin.class);',
            1
        )
    else:
        # Создаём onCreate
        insertion = '''
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GamePlugin.class);
        super.onCreate(savedInstanceState);
    }
'''
        # Вставляем перед последней закрывающей }
        last_brace = content.rfind('}')
        if last_brace != -1:
            content = content[:last_brace] + insertion + content[last_brace:]

with open(file_path, 'w') as f:
    f.write(content)

print("✅ GamePlugin registered in MainActivity")
PYEOF
      python3 /tmp/patch_gp.py "$MAIN_ACTIVITY"
      echo "✅ GamePlugin добавлен в MainActivity"
    fi

    # Проверка
    echo "=== Проверка registerPlugin ==="

# === Поднимаем versionCode и versionName ===
echo ""
echo "=== Обновляем versionCode + versionName ==="
BUILD_GRADLE_APP="android/app/build.gradle"

if [ -f "$BUILD_GRADLE_APP" ]; then
  # versionCode = 2 (RuStore требует > предыдущего)
  sed -i "s/versionCode [0-9]*/versionCode 2/" "$BUILD_GRADLE_APP"
  # versionName = "1.0.1"
  sed -i 's/versionName "[^"]*"/versionName "1.0.1"/' "$BUILD_GRADLE_APP"
  
  echo "✅ versionCode = 2, versionName = 1.0.1"
  grep -n "versionCode\|versionName" "$BUILD_GRADLE_APP" || echo "  ❌ НЕ НАЙДЕНО"
else
  echo "❌ Не нашли $BUILD_GRADLE_APP"
fi
    grep -c "registerPlugin(GamePlugin" "$MAIN_ACTIVITY" || echo "  ❌ НЕ НАЙДЕНО"
  fi
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
