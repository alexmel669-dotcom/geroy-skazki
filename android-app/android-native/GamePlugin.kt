package ru.geroy_skazki.app

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Мост HTML ↔ нативная мини-игра «Рыбалка».
 * Вызов из WebView: Capacitor.Plugins.GamePlugin.startFishGame()
 */
@CapacitorPlugin(name = "GamePlugin")
class GamePlugin : Plugin() {

    @PluginMethod
    fun startFishGame(call: PluginCall) {
        val intent = Intent(context, FishGameActivity::class.java)
        activity.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun closeGame(call: PluginCall) {
        // FishGameActivity закрывает себя сама (back/✕/"Выйти" → finish()).
        // Метод оставлен для симметричного API на стороне HTML — можно
        // безопасно дёрнуть его "на всякий случай", ничего не сломает.
        call.resolve()
    }
}
