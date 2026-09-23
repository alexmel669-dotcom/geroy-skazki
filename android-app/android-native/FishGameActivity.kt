package ru.geroy_skazki.app

import android.app.Activity
import android.os.Bundle

/**
 * Хост-Activity для офлайн-мини-игры «Рыбалка».
 * Fullscreen/portrait/no-title заданы темой в AndroidManifest.xml
 * (Theme.NoTitleBar.Fullscreen) — здесь только жизненный цикл.
 */
class FishGameActivity : Activity(), FishGameView.Listener {

    private lateinit var gameView: FishGameView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        gameView = FishGameView(this)
        gameView.listener = this
        setContentView(gameView)
    }

    override fun onResume() {
        super.onResume()
        gameView.resume()
    }

    override fun onPause() {
        gameView.pause()
        super.onPause()
    }

    override fun onBackPressed() {
        finish()
    }

    // FishGameView.Listener — вызывается по тапу на "✕" в HUD и на "Выйти" в RESULT
    override fun onRequestClose() {
        finish()
    }
}
