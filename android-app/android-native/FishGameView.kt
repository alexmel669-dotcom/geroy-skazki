package ru.geroy_skazki.app

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * "Рыбалка" — офлайн-мини-игра для GamePlugin.
 *
 * View + Choreographer вместо SurfaceView: на экране одновременно всего
 * несколько десятков простых фигур, отдельный render-поток избыточен —
 * doFrame() -> update() -> invalidate() -> postFrameCallback гоняет ~60 FPS
 * прямо в UI-потоке без просадок.
 *
 * Несколько мест, где код сознательно уточняет ТЗ (везде отмечено комментарием):
 *  - вес предметов в спавне нормализуется (сумма процентов из ТЗ = 93.5%,
 *    не 100%) — пропорции между предметами сохранены точно;
 *  - хитбокс для тапа сделан заметно больше видимой фигуры (детские пальцы,
 *    маленький экран);
 *  - счёт не уходит в минус (клампится по 0) — не пугать ребёнка отрицательным
 *    числом;
 *  - добавлена лёгкая плавающая подпись "+10"/"-5" при поимке — для
 *    "зрелищности", это не XP/ачивка/leaderboard, просто мгновенный фидбек;
 *  - "🔥x3" в HUD — это текущая длина комбо (streak), а не множитель очков
 *    (множитель фиксирован x2 и включается начиная с 3-го подряд попадания).
 */
class FishGameView(context: Context) : View(context), Choreographer.FrameCallback {

    interface Listener {
        fun onRequestClose()
    }

    var listener: Listener? = null

    private enum class GameState { INTRO, PLAYING, RESULT }

    private enum class ItemType(val points: Int, val weight: Float) {
        FISH(10, 0.35f),
        NEMO(30, 0.05f),
        SHARK(50, 0.02f),
        CHEST(75, 0.015f),
        BOOT(-5, 0.28f),
        BUCKET(-3, 0.14f),
        GRASS(0, 0.08f)
    }

    private class FishItem(
        val type: ItemType,
        var x: Float,
        val baseY: Float,
        var vx: Float,
        val lifespanMs: Long,
        val bobPhase: Float
    ) {
        var ageMs: Long = 0L
        var bobOffsetY: Float = 0f
        var alpha: Float = 0f
    }

    private class Bubble(var x: Float, var y: Float, var size: Float, var speed: Float)

    private class Popup(var x: Float, var y: Float, val text: String, val color: Int) {
        var ageMs: Long = 0L
    }

    companion object {
        private const val PREFS_NAME = "fish_game_prefs"
        private const val KEY_HIGH_SCORE = "high_score"
        private const val GAME_DURATION_MS = 30_000L
        private const val SPAWN_INTERVAL_MS = 1_200L
        private const val MAX_DT_MS = 100L
        private const val HIT_PADDING_SCALE = 1.35f
        private const val POPUP_LIFETIME_MS = 700L
        private const val ITEM_FADE_MS = 250L
    }

    private val density = resources.displayMetrics.density
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val vibrator: Vibrator? = context.getSystemService(Vibrator::class.java)

    private val itemTable = ItemType.values().toList()
    private val itemTotalWeight = itemTable.sumOf { it.weight.toDouble() }.toFloat()

    private var state = GameState.INTRO
    private var running = false
    private var lastFrameTimeNanos = 0L
    private var elapsedMs = 0L

    private var score = 0
    private var combo = 0
    private var timeLeftMs = GAME_DURATION_MS
    private var spawnAccumulatorMs = 0L
    private var highScore = prefs.getInt(KEY_HIGH_SCORE, 0)

    private val items = mutableListOf<FishItem>()
    private val bubbles = mutableListOf<Bubble>()
    private val popups = mutableListOf<Popup>()

    // ---------- layout (пересчитывается в onSizeChanged) ----------
    private var hudBottom = 0f
    private var seaweedTop = 0f
    private val closeButtonRect = RectF()
    private val startButtonRect = RectF()
    private val retryButtonRect = RectF()
    private val exitButtonRect = RectF()
    private val cardRect = RectF()

    // ---------- переиспользуемые Paint (Canvas рисует последовательно —
    // мутировать общий Paint между вызовами drawXxx безопасно и дёшево) ----------
    private val bgPaint = Paint()
    private val shapePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.DEFAULT_BOLD }
    private val bubblePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val overlayPaint = Paint().apply { color = Color.BLACK }

    init {
        isClickable = true
    }

    // ================= жизненный цикл =================

    fun pause() {
        running = false
        Choreographer.getInstance().removeFrameCallback(this)
    }

    fun resume() {
        if (running) return
        running = true
        lastFrameTimeNanos = 0L
        Choreographer.getInstance().postFrameCallback(this)
    }

    override fun doFrame(frameTimeNanos: Long) {
        if (!running) return
        if (lastFrameTimeNanos == 0L) lastFrameTimeNanos = frameTimeNanos
        var dtMs = (frameTimeNanos - lastFrameTimeNanos) / 1_000_000L
        lastFrameTimeNanos = frameTimeNanos
        if (dtMs > MAX_DT_MS) dtMs = MAX_DT_MS
        update(dtMs)
        invalidate()
        Choreographer.getInstance().postFrameCallback(this)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) return
        bgPaint.shader = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(Color.parseColor("#1a5276"), Color.parseColor("#154360"), Color.parseColor("#0a1628")),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        hudBottom = 56f * density
        seaweedTop = h - 150f * density
        layoutButtons(w.toFloat(), h.toFloat())
        if (bubbles.isEmpty()) seedBubbles(w.toFloat(), h.toFloat())
    }

    private fun layoutButtons(w: Float, h: Float) {
        val btnSize = 40f * density
        closeButtonRect.set(w - btnSize - 12f * density, 8f * density, w - 12f * density, 8f * density + btnSize)

        val startW = 220f * density
        val startH = 64f * density
        startButtonRect.set(w / 2f - startW / 2f, h * 0.62f, w / 2f + startW / 2f, h * 0.62f + startH)

        val cardW = min(w * 0.82f, 340f * density)
        val cardH = 360f * density
        cardRect.set(w / 2f - cardW / 2f, h / 2f - cardH / 2f, w / 2f + cardW / 2f, h / 2f + cardH / 2f)

        val btnW = cardRect.width() * 0.8f
        val btnH = 52f * density
        retryButtonRect.set(
            cardRect.centerX() - btnW / 2f, cardRect.bottom - btnH * 2 - 24f * density,
            cardRect.centerX() + btnW / 2f, cardRect.bottom - btnH - 24f * density
        )
        exitButtonRect.set(
            cardRect.centerX() - btnW / 2f, cardRect.bottom - btnH - 12f * density,
            cardRect.centerX() + btnW / 2f, cardRect.bottom - 12f * density
        )
    }

    // ================= обновление =================

    private fun update(dtMs: Long) {
        elapsedMs += dtMs
        updateBubbles(dtMs)
        updatePopups(dtMs)

        if (state != GameState.PLAYING) return

        timeLeftMs -= dtMs
        if (timeLeftMs <= 0L) {
            timeLeftMs = 0L
            endGame()
            return
        }

        spawnAccumulatorMs += dtMs
        while (spawnAccumulatorMs >= SPAWN_INTERVAL_MS) {
            spawnAccumulatorMs -= SPAWN_INTERVAL_MS
            spawnItem()
        }

        val marginX = 30f * density
        val w = width.toFloat()
        val it = items.iterator()
        while (it.hasNext()) {
            val item = it.next()
            item.ageMs += dtMs
            item.x += item.vx * dtMs / 1000f
            if (item.x < marginX) {
                item.x = marginX; item.vx = -item.vx
            }
            if (item.x > w - marginX) {
                item.x = w - marginX; item.vx = -item.vx
            }
            item.bobOffsetY = sin(item.ageMs / 1000.0 * 2.0 + item.bobPhase).toFloat() * 8f * density
            item.alpha = when {
                item.ageMs < ITEM_FADE_MS -> item.ageMs / ITEM_FADE_MS.toFloat()
                item.lifespanMs - item.ageMs < ITEM_FADE_MS -> max(0f, (item.lifespanMs - item.ageMs) / ITEM_FADE_MS.toFloat())
                else -> 1f
            }
            if (item.ageMs >= item.lifespanMs) it.remove()
        }
    }

    private fun updateBubbles(dtMs: Long) {
        val h = height.toFloat(); val w = width.toFloat()
        if (h <= 0f || w <= 0f) return
        for (b in bubbles) {
            b.y -= b.speed * dtMs / 1000f
            if (b.y < -b.size) {
                b.y = h + b.size
                b.x = Random.nextFloat() * w
                b.size = (4f + Random.nextFloat() * 8f) * density
                b.speed = (150f + Random.nextFloat() * 100f) * density
            }
        }
    }

    private fun updatePopups(dtMs: Long) {
        val it = popups.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.ageMs += dtMs
            p.y -= 40f * density * dtMs / 1000f
            if (p.ageMs >= POPUP_LIFETIME_MS) it.remove()
        }
    }

    private fun seedBubbles(w: Float, h: Float) {
        bubbles.clear()
        repeat(18) {
            bubbles.add(
                Bubble(
                    x = Random.nextFloat() * w,
                    y = Random.nextFloat() * h,
                    size = (4f + Random.nextFloat() * 8f) * density,
                    speed = (150f + Random.nextFloat() * 100f) * density
                )
            )
        }
    }

    private fun spawnItem() {
        val w = width.toFloat(); val h = height.toFloat()
        if (w <= 0f || h <= 0f) return
        val top = hudBottom + 20f * density
        val bottom = seaweedTop - 10f * density
        if (bottom <= top) return
        val marginX = 40f * density
        val type = pickRandomType()
        val x = marginX + Random.nextFloat() * max(1f, w - marginX * 2)
        val y = top + Random.nextFloat() * (bottom - top)
        val vx = (Random.nextFloat() * 2f - 1f) * 18f * density
        val lifespan = 4000L + Random.nextInt(2001)
        items.add(FishItem(type, x, y, vx, lifespan, Random.nextFloat() * 6.28f))
    }

    private fun pickRandomType(): ItemType {
        // Сумма весов из ТЗ = 93.5%, не 100% — нормализуем по itemTotalWeight,
        // чтобы сохранить точные пропорции между предметами.
        val r = Random.nextFloat() * itemTotalWeight
        var acc = 0f
        for (type in itemTable) {
            acc += type.weight
            if (r <= acc) return type
        }
        return itemTable.last()
    }

    // ================= тап =================

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_DOWN) return true
        val x = event.x; val y = event.y
        when (state) {
            GameState.INTRO -> if (startButtonRect.contains(x, y)) startGame()
            GameState.PLAYING -> {
                if (closeButtonRect.contains(x, y)) {
                    listener?.onRequestClose()
                } else {
                    handleItemTap(x, y)
                }
            }
            GameState.RESULT -> {
                if (retryButtonRect.contains(x, y)) startGame()
                else if (exitButtonRect.contains(x, y)) listener?.onRequestClose()
            }
        }
        return true
    }

    private fun handleItemTap(x: Float, y: Float) {
        for (i in items.indices.reversed()) {
            val item = items[i]
            val (halfW, halfH) = extentFor(item.type)
            val hw = halfW * HIT_PADDING_SCALE
            val hh = halfH * HIT_PADDING_SCALE
            val cy = item.baseY + item.bobOffsetY
            if (x in (item.x - hw)..(item.x + hw) && y in (cy - hh)..(cy + hh)) {
                catchItem(item)
                items.removeAt(i)
                break
            }
        }
    }

    private fun catchItem(item: FishItem) {
        val basePoints = item.type.points
        val gained = when {
            basePoints > 0 -> {
                combo += 1
                basePoints * (if (combo >= 3) 2 else 1)
            }
            basePoints < 0 -> {
                combo = 0
                basePoints
            }
            else -> 0 // трава: не очки, не промах — комбо не трогаем
        }
        if (gained != 0) {
            score = max(0, score + gained) // счёт не уходит в минус
            val color = if (gained > 0) Color.parseColor("#4CAF50") else Color.parseColor("#EF5350")
            val text = if (gained > 0) "+$gained" else "$gained"
            popups.add(Popup(item.x, item.baseY + item.bobOffsetY, text, color))
        }
        vibrateShort()
    }

    private fun vibrateShort() {
        val v = vibrator ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(20L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                // VibrationEffect недоступен до API 26 — на API 23-25 это
                // единственный способ вибрации; предупреждение подавлено
                // намеренно и только здесь.
                @Suppress("DEPRECATION")
                v.vibrate(20L)
            }
        } catch (_: Exception) {
            // Нет вибромотора/запрещено политикой устройства — не критично для игры
        }
    }

    private fun startGame() {
        score = 0
        combo = 0
        timeLeftMs = GAME_DURATION_MS
        spawnAccumulatorMs = 0L
        items.clear()
        popups.clear()
        state = GameState.PLAYING
    }

    private fun endGame() {
        state = GameState.RESULT
        if (score > highScore) {
            highScore = score
            prefs.edit().putInt(KEY_HIGH_SCORE, highScore).apply()
        }
    }

    // ================= размеры фигур/хитбоксов (px с учётом density) =================

    private fun extentFor(type: ItemType): Pair<Float, Float> = when (type) {
        ItemType.FISH -> 27f * density to 16f * density
        ItemType.NEMO -> 24f * density to 15f * density
        ItemType.SHARK -> 34f * density to 22f * density
        ItemType.CHEST -> 22f * density to 17f * density
        ItemType.BOOT -> 20f * density to 26f * density
        ItemType.BUCKET -> 18f * density to 24f * density
        ItemType.GRASS -> 14f * density to 26f * density
    }

    // ================= отрисовка =================

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat(); val h = height.toFloat()
        canvas.drawRect(0f, 0f, w, h, bgPaint)
        drawSeaweed(canvas, w, h)
        drawBubbles(canvas)
        for (item in items) drawItem(canvas, item)
        drawPopups(canvas)
        drawHud(canvas, w)
        when (state) {
            GameState.INTRO -> drawIntroOverlay(canvas, w, h)
            GameState.RESULT -> drawResultOverlay(canvas, w, h)
            GameState.PLAYING -> {}
        }
    }

    private fun drawSeaweed(canvas: Canvas, w: Float, h: Float) {
        val ribbonCount = 5
        val ribbonWidth = 20f * density
        val ribbonHeight = 150f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#2d5a27")
        for (i in 0 until ribbonCount) {
            val baseX = w * (i + 1) / (ribbonCount + 1)
            val phase = i * 1.3f
            val path = Path()
            val segments = 8
            path.moveTo(baseX - ribbonWidth / 2f, h)
            for (s in 1..segments) {
                val t = s / segments.toFloat()
                val y = h - ribbonHeight * t
                val sway = sin(elapsedMs / 900.0 + phase + t * 2.0).toFloat() * 10f * density * t
                path.lineTo(baseX - ribbonWidth / 2f + sway, y)
            }
            for (s in segments downTo 0) {
                val t = s / segments.toFloat()
                val y = h - ribbonHeight * t
                val sway = sin(elapsedMs / 900.0 + phase + t * 2.0).toFloat() * 10f * density * t
                path.lineTo(baseX + ribbonWidth / 2f + sway, y)
            }
            path.close()
            canvas.drawPath(path, shapePaint)
        }
    }

    private fun drawBubbles(canvas: Canvas) {
        bubblePaint.alpha = (255 * 0.3f).toInt()
        for (b in bubbles) canvas.drawCircle(b.x, b.y, b.size / 2f, bubblePaint)
    }

    private fun drawItem(canvas: Canvas, item: FishItem) {
        val cx = item.x
        val cy = item.baseY + item.bobOffsetY
        val layer = canvas.saveLayerAlpha(
            cx - 70f * density, cy - 70f * density, cx + 70f * density, cy + 70f * density,
            (item.alpha.coerceIn(0f, 1f) * 255).toInt()
        )
        when (item.type) {
            ItemType.NEMO -> drawGlow(canvas, cx, cy, 34f * density, Color.WHITE)
            ItemType.SHARK -> drawGlow(canvas, cx, cy, 46f * density, Color.RED)
            else -> {}
        }
        when (item.type) {
            ItemType.FISH -> drawFish(canvas, cx, cy)
            ItemType.NEMO -> drawNemo(canvas, cx, cy)
            ItemType.SHARK -> drawShark(canvas, cx, cy)
            ItemType.CHEST -> drawChest(canvas, cx, cy)
            ItemType.BOOT -> drawBoot(canvas, cx, cy)
            ItemType.BUCKET -> drawBucket(canvas, cx, cy)
            ItemType.GRASS -> drawGrass(canvas, cx, cy)
        }
        canvas.restoreToCount(layer)
    }

    private fun drawGlow(canvas: Canvas, cx: Float, cy: Float, radius: Float, color: Int) {
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = color
        shapePaint.alpha = (255 * 0.3f).toInt()
        canvas.drawCircle(cx, cy, radius, shapePaint)
        shapePaint.alpha = 255
    }

    private fun drawFish(canvas: Canvas, cx: Float, cy: Float) {
        val bw = 40f * density; val bh = 25f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#FF8C32")
        canvas.drawOval(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, shapePaint)
        val tail = Path().apply {
            moveTo(cx - bw / 2, cy)
            lineTo(cx - bw / 2 - 14f * density, cy - 10f * density)
            lineTo(cx - bw / 2 - 14f * density, cy + 10f * density)
            close()
        }
        canvas.drawPath(tail, shapePaint)
        shapePaint.color = Color.BLACK
        canvas.drawCircle(cx + bw * 0.22f, cy - bh * 0.15f, 2.2f * density, shapePaint)
    }

    private fun drawNemo(canvas: Canvas, cx: Float, cy: Float) {
        val bw = 38f * density; val bh = 24f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#E23B2E")
        canvas.drawOval(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, shapePaint)
        shapePaint.color = Color.WHITE
        val stripeW = 3.4f * density
        for (i in -1..1) {
            val sx = cx + i * (bw * 0.24f)
            canvas.drawRect(sx - stripeW / 2, cy - bh / 2, sx + stripeW / 2, cy + bh / 2, shapePaint)
        }
        shapePaint.color = Color.BLACK
        canvas.drawCircle(cx + bw * 0.3f, cy - bh * 0.15f, 2.2f * density, shapePaint)
    }

    private fun drawShark(canvas: Canvas, cx: Float, cy: Float) {
        val bw = 60f * density; val bh = 35f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#8B93A0")
        canvas.drawOval(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, shapePaint)
        val fin = Path().apply {
            moveTo(cx - 6f * density, cy - bh / 2)
            lineTo(cx + 8f * density, cy - bh / 2 - 18f * density)
            lineTo(cx + 18f * density, cy - bh / 2)
            close()
        }
        canvas.drawPath(fin, shapePaint)
        shapePaint.color = Color.WHITE
        val mouthY = cy + bh * 0.18f
        var tx = cx - bw * 0.32f
        repeat(5) {
            val tooth = Path().apply {
                moveTo(tx, mouthY)
                lineTo(tx + 4f * density, mouthY + 7f * density)
                lineTo(tx + 8f * density, mouthY)
                close()
            }
            canvas.drawPath(tooth, shapePaint)
            tx += 8f * density
        }
        shapePaint.color = Color.BLACK
        canvas.drawCircle(cx + bw * 0.28f, cy - bh * 0.22f, 2.6f * density, shapePaint)
    }

    private fun drawChest(canvas: Canvas, cx: Float, cy: Float) {
        val bw = 40f * density; val bh = 30f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#6B4226")
        canvas.drawRoundRect(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, 4f * density, 4f * density, shapePaint)
        shapePaint.color = Color.parseColor("#FFD54A")
        canvas.drawRect(cx - bw / 2, cy - 4f * density, cx + bw / 2, cy + 4f * density, shapePaint)
        shapePaint.color = Color.parseColor("#3D2A18")
        canvas.drawCircle(cx, cy, 3.2f * density, shapePaint)
    }

    private fun drawBoot(canvas: Canvas, cx: Float, cy: Float) {
        canvas.save()
        canvas.rotate(30f, cx, cy)
        val bw = 20f * density; val bh = 40f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#1C1C1C")
        canvas.drawRoundRect(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, 3f * density, 3f * density, shapePaint)
        canvas.restore()
    }

    private fun drawBucket(canvas: Canvas, cx: Float, cy: Float) {
        val bw = 30f * density; val bh = 30f * density
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.parseColor("#9CA3AF")
        canvas.drawRoundRect(cx - bw / 2, cy - bh / 2 + 4f * density, cx + bw / 2, cy + bh / 2, 3f * density, 3f * density, shapePaint)
        canvas.drawOval(cx - bw / 2, cy - bh / 2 - 2f * density, cx + bw / 2, cy - bh / 2 + 8f * density, shapePaint)
        strokePaint.color = Color.parseColor("#6B7280")
        strokePaint.strokeWidth = 2.4f * density
        canvas.drawArc(cx - bw * 0.3f, cy - bh / 2 - 14f * density, cx + bw * 0.3f, cy - bh / 2 + 4f * density, 180f, 180f, false, strokePaint)
    }

    private fun drawGrass(canvas: Canvas, cx: Float, cy: Float) {
        strokePaint.color = Color.parseColor("#3FA34D")
        strokePaint.strokeWidth = 4f * density
        val path = Path().apply {
            moveTo(cx, cy + 20f * density)
            quadTo(cx - 10f * density, cy + 5f * density, cx, cy - 10f * density)
            quadTo(cx + 10f * density, cy - 20f * density, cx, cy - 30f * density)
        }
        canvas.drawPath(path, strokePaint)
    }

    private fun drawPopups(canvas: Canvas) {
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.textSize = 16f * density
        for (p in popups) {
            val alpha = (255 * (1f - p.ageMs / POPUP_LIFETIME_MS.toFloat())).toInt().coerceIn(0, 255)
            textPaint.color = p.color
            textPaint.alpha = alpha
            canvas.drawText(p.text, p.x, p.y, textPaint)
        }
        textPaint.alpha = 255
    }

    private fun drawHud(canvas: Canvas, w: Float) {
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.argb(140, 10, 22, 40)
        canvas.drawRect(0f, 0f, w, hudBottom, shapePaint)

        textPaint.textAlign = Paint.Align.LEFT
        textPaint.textSize = 15f * density
        textPaint.color = Color.WHITE
        canvas.drawText("🎣 Рыбалка", 14f * density, hudBottom * 0.62f, textPaint)

        textPaint.textAlign = Paint.Align.CENTER
        canvas.drawText("Счёт: $score", w / 2f, hudBottom * 0.62f, textPaint)

        val secondsLeft = ((timeLeftMs + 999L) / 1000L).toInt()
        textPaint.textAlign = Paint.Align.RIGHT
        canvas.drawText("⏱ ${secondsLeft}с", closeButtonRect.left - 10f * density, hudBottom * 0.62f, textPaint)

        if (combo >= 3) {
            textPaint.textAlign = Paint.Align.LEFT
            textPaint.color = Color.parseColor("#FFD700")
            textPaint.textSize = 13f * density
            canvas.drawText("🔥x$combo", 14f * density, hudBottom * 0.95f, textPaint)
        }

        // кнопка закрытия "✕"
        shapePaint.color = Color.argb(160, 0, 0, 0)
        canvas.drawOval(closeButtonRect, shapePaint)
        strokePaint.color = Color.WHITE
        strokePaint.strokeWidth = 2.6f * density
        val pad = closeButtonRect.width() * 0.28f
        canvas.drawLine(closeButtonRect.left + pad, closeButtonRect.top + pad, closeButtonRect.right - pad, closeButtonRect.bottom - pad, strokePaint)
        canvas.drawLine(closeButtonRect.right - pad, closeButtonRect.top + pad, closeButtonRect.left + pad, closeButtonRect.bottom - pad, strokePaint)
    }

    private fun drawIntroOverlay(canvas: Canvas, w: Float, h: Float) {
        overlayPaint.alpha = (255 * 0.55f).toInt()
        canvas.drawRect(0f, 0f, w, h, overlayPaint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.WHITE
        textPaint.textSize = 26f * density
        canvas.drawText("Рыбалка", w / 2f, h * 0.32f, textPaint)

        textPaint.textSize = 15f * density
        canvas.drawText("Тапай по рыбкам и сокровищам —", w / 2f, h * 0.40f, textPaint)
        canvas.drawText("у тебя 30 секунд!", w / 2f, h * 0.44f, textPaint)

        drawButton(canvas, startButtonRect, "Начать", Color.parseColor("#FFC107"), Color.parseColor("#3D2A18"))
    }

    private fun drawResultOverlay(canvas: Canvas, w: Float, h: Float) {
        overlayPaint.alpha = (255 * 0.85f).toInt()
        canvas.drawRect(0f, 0f, w, h, overlayPaint)

        shapePaint.style = Paint.Style.FILL
        shapePaint.color = Color.WHITE
        canvas.drawRoundRect(cardRect, 20f * density, 20f * density, shapePaint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.parseColor("#154360")
        textPaint.textSize = 20f * density
        canvas.drawText("Улов подведён!", cardRect.centerX(), cardRect.top + 44f * density, textPaint)

        textPaint.textSize = 34f * density
        textPaint.color = Color.parseColor("#1a5276")
        canvas.drawText("$score", cardRect.centerX(), cardRect.top + 100f * density, textPaint)

        drawStars(canvas, cardRect.centerX(), cardRect.top + 140f * density, starsFor(score))

        textPaint.textSize = 14f * density
        textPaint.color = Color.GRAY
        canvas.drawText("Рекорд: $highScore", cardRect.centerX(), cardRect.top + 178f * density, textPaint)

        drawButton(canvas, retryButtonRect, "🔁 Ещё раз", Color.parseColor("#FFC107"), Color.parseColor("#3D2A18"))
        drawButton(canvas, exitButtonRect, "🚪 Выйти", Color.parseColor("#E0E0E0"), Color.parseColor("#333333"))
    }

    private fun drawButton(canvas: Canvas, rect: RectF, label: String, bg: Int, fg: Int) {
        shapePaint.style = Paint.Style.FILL
        shapePaint.color = bg
        canvas.drawRoundRect(rect, 14f * density, 14f * density, shapePaint)
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = fg
        textPaint.textSize = 17f * density
        canvas.drawText(label, rect.centerX(), rect.centerY() + 6f * density, textPaint)
    }

    private fun starPath(cx: Float, cy: Float, outerR: Float, innerR: Float): Path {
        val path = Path()
        val points = 5
        for (i in 0 until points * 2) {
            val r = if (i % 2 == 0) outerR else innerR
            val angle = Math.PI / 2 + i * Math.PI / points
            val px = cx + (r * cos(angle)).toFloat()
            val py = cy - (r * sin(angle)).toFloat()
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        path.close()
        return path
    }

    private fun drawStars(canvas: Canvas, cx: Float, cy: Float, filledCount: Int) {
        val spacing = 34f * density
        val startX = cx - spacing
        shapePaint.style = Paint.Style.FILL
        for (i in 0..2) {
            val sx = startX + i * spacing
            shapePaint.color = if (i < filledCount) Color.parseColor("#FFD54A") else Color.parseColor("#D9D9D9")
            canvas.drawPath(starPath(sx, cy, 16f * density, 7f * density), shapePaint)
        }
    }

    private fun starsFor(score: Int): Int = when {
        score >= 81 -> 3
        score >= 31 -> 2
        else -> 1
    }
}
