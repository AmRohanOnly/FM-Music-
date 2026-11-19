package com.fmmusic.client.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/**
 * Minimalist, high-performance vector icons drawn with pure Compose Canvas.
 * Zero external font/emoji dependencies, crisp 60fps rendering, perfectly scaled.
 */

@Composable
fun PlayIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(w * 0.30f, h * 0.20f)
            lineTo(w * 0.82f, h * 0.50f)
            lineTo(w * 0.30f, h * 0.80f)
            close()
        }
        drawPath(path, color = tint, style = Fill)
    }
}

@Composable
fun PauseIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val barW = w * 0.22f
        val barH = h * 0.60f
        val top = h * 0.20f
        val r = barW * 0.35f

        drawRoundRect(
            color = tint,
            topLeft = Offset(w * 0.22f, top),
            size = Size(barW, barH),
            cornerRadius = CornerRadius(r, r)
        )
        drawRoundRect(
            color = tint,
            topLeft = Offset(w * 0.56f, top),
            size = Size(barW, barH),
            cornerRadius = CornerRadius(r, r)
        )
    }
}

@Composable
fun NextIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(w * 0.20f, h * 0.22f)
            lineTo(w * 0.64f, h * 0.50f)
            lineTo(w * 0.20f, h * 0.78f)
            close()
        }
        drawPath(path, color = tint, style = Fill)
        val barW = w * 0.12f
        drawRoundRect(
            color = tint,
            topLeft = Offset(w * 0.72f, h * 0.22f),
            size = Size(barW, h * 0.56f),
            cornerRadius = CornerRadius(barW * 0.3f, barW * 0.3f)
        )
    }
}

@Composable
fun PrevIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val barW = w * 0.12f
        drawRoundRect(
            color = tint,
            topLeft = Offset(w * 0.16f, h * 0.22f),
            size = Size(barW, h * 0.56f),
            cornerRadius = CornerRadius(barW * 0.3f, barW * 0.3f)
        )
        val path = Path().apply {
            moveTo(w * 0.80f, h * 0.22f)
            lineTo(w * 0.36f, h * 0.50f)
            lineTo(w * 0.80f, h * 0.78f)
            close()
        }
        drawPath(path, color = tint, style = Fill)
    }
}

@Composable
fun ShuffleIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.09f

        // Top line crossing down
        val path1 = Path().apply {
            moveTo(w * 0.18f, h * 0.32f)
            cubicTo(w * 0.45f, h * 0.32f, w * 0.55f, h * 0.68f, w * 0.76f, h * 0.68f)
        }
        drawPath(path1, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

        // Arrow head 1
        val head1 = Path().apply {
            moveTo(w * 0.66f, h * 0.58f)
            lineTo(w * 0.78f, h * 0.68f)
            lineTo(w * 0.66f, h * 0.78f)
        }
        drawPath(head1, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))

        // Bottom line crossing up
        val path2 = Path().apply {
            moveTo(w * 0.18f, h * 0.68f)
            cubicTo(w * 0.40f, h * 0.68f, w * 0.46f, h * 0.52f, w * 0.50f, h * 0.50f)
        }
        drawPath(path2, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

        val path3 = Path().apply {
            moveTo(w * 0.58f, h * 0.44f)
            cubicTo(w * 0.63f, h * 0.36f, w * 0.68f, h * 0.32f, w * 0.76f, h * 0.32f)
        }
        drawPath(path3, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

        // Arrow head 2
        val head2 = Path().apply {
            moveTo(w * 0.66f, h * 0.22f)
            lineTo(w * 0.78f, h * 0.32f)
            lineTo(w * 0.66f, h * 0.42f)
        }
        drawPath(head2, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun RepeatIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isOne: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.09f

        // Loop top & right
        val loop1 = Path().apply {
            moveTo(w * 0.30f, h * 0.32f)
            lineTo(w * 0.70f, h * 0.32f)
            cubicTo(w * 0.82f, h * 0.32f, w * 0.82f, h * 0.50f, w * 0.82f, h * 0.50f)
        }
        drawPath(loop1, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

        // Top arrow
        val arrow1 = Path().apply {
            moveTo(w * 0.62f, h * 0.22f)
            lineTo(w * 0.74f, h * 0.32f)
            lineTo(w * 0.62f, h * 0.42f)
        }
        drawPath(arrow1, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))

        // Loop bottom & left
        val loop2 = Path().apply {
            moveTo(w * 0.70f, h * 0.68f)
            lineTo(w * 0.30f, h * 0.68f)
            cubicTo(w * 0.18f, h * 0.68f, w * 0.18f, h * 0.50f, w * 0.18f, h * 0.50f)
        }
        drawPath(loop2, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

        // Bottom arrow
        val arrow2 = Path().apply {
            moveTo(w * 0.38f, h * 0.58f)
            lineTo(w * 0.26f, h * 0.68f)
            lineTo(w * 0.38f, h * 0.78f)
        }
        drawPath(arrow2, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))

        if (isOne) {
            // Draw a subtle "1" in center
            val onePath = Path().apply {
                moveTo(w * 0.45f, h * 0.46f)
                lineTo(w * 0.50f, h * 0.42f)
                lineTo(w * 0.50f, h * 0.58f)
            }
            drawPath(onePath, color = tint, style = Stroke(width = strokeW * 1.1f, cap = StrokeCap.Round))
        }
    }
}

@Composable
fun HeartIcon(
    modifier: Modifier = Modifier.size(24.dp),
    isFilled: Boolean = false,
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height

        val path = Path().apply {
            moveTo(w * 0.5f, h * 0.82f)
            cubicTo(w * 0.15f, h * 0.55f, w * 0.08f, h * 0.32f, w * 0.24f, h * 0.20f)
            cubicTo(w * 0.38f, h * 0.10f, w * 0.48f, h * 0.22f, w * 0.5f, h * 0.30f)
            cubicTo(w * 0.52f, h * 0.22f, w * 0.62f, h * 0.10f, w * 0.76f, h * 0.20f)
            cubicTo(w * 0.92f, h * 0.32f, w * 0.85f, h * 0.55f, w * 0.5f, h * 0.82f)
            close()
        }

        if (isFilled) {
            drawPath(path, color = tint, style = Fill)
        } else {
            drawPath(path, color = tint, style = Stroke(width = w * 0.08f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

@Composable
fun DownloadIcon(
    modifier: Modifier = Modifier.size(24.dp),
    isDownloaded: Boolean = false,
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.09f

        if (isDownloaded) {
            // Checkmark in circle
            drawCircle(color = tint, radius = w * 0.42f, style = Stroke(width = strokeW))
            val checkPath = Path().apply {
                moveTo(w * 0.32f, h * 0.50f)
                lineTo(w * 0.46f, h * 0.64f)
                lineTo(w * 0.68f, h * 0.38f)
            }
            drawPath(checkPath, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))
        } else {
            // Down arrow
            val arrow = Path().apply {
                moveTo(w * 0.50f, h * 0.18f)
                lineTo(w * 0.50f, h * 0.62f)
            }
            drawPath(arrow, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))

            val head = Path().apply {
                moveTo(w * 0.34f, h * 0.48f)
                lineTo(w * 0.50f, h * 0.64f)
                lineTo(w * 0.66f, h * 0.48f)
            }
            drawPath(head, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))

            // Bottom tray
            val tray = Path().apply {
                moveTo(w * 0.22f, h * 0.80f)
                lineTo(w * 0.78f, h * 0.80f)
            }
            drawPath(tray, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))
        }
    }
}

@Composable
fun ChevronDownIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.10f
        val path = Path().apply {
            moveTo(w * 0.22f, h * 0.38f)
            lineTo(w * 0.50f, h * 0.66f)
            lineTo(w * 0.78f, h * 0.38f)
        }
        drawPath(path, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun PlusIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.10f
        drawLine(color = tint, start = Offset(w * 0.50f, h * 0.22f), end = Offset(w * 0.50f, h * 0.78f), strokeWidth = strokeW, cap = StrokeCap.Round)
        drawLine(color = tint, start = Offset(w * 0.22f, h * 0.50f), end = Offset(w * 0.78f, h * 0.50f), strokeWidth = strokeW, cap = StrokeCap.Round)
    }
}

@Composable
fun SearchIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.09f
        val radius = w * 0.28f
        drawCircle(color = tint, center = Offset(w * 0.44f, h * 0.44f), radius = radius, style = Stroke(width = strokeW))
        drawLine(
            color = tint,
            start = Offset(w * 0.64f, h * 0.64f),
            end = Offset(w * 0.84f, h * 0.84f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
    }
}

@Composable
fun HomeIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isFilled: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f
        val path = Path().apply {
            moveTo(w * 0.50f, h * 0.16f)
            lineTo(w * 0.84f, h * 0.46f)
            lineTo(w * 0.74f, h * 0.46f)
            lineTo(w * 0.74f, h * 0.84f)
            lineTo(w * 0.26f, h * 0.84f)
            lineTo(w * 0.26f, h * 0.46f)
            lineTo(w * 0.16f, h * 0.46f)
            close()
        }
        if (isFilled) {
            drawPath(path, color = tint, style = Fill)
        } else {
            drawPath(path, color = tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

@Composable
fun ExploreIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isFilled: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f
        // Compass outer ring
        drawCircle(color = tint, radius = w * 0.38f, style = Stroke(width = strokeW))
        // Compass needle diamond
        val needle = Path().apply {
            moveTo(w * 0.50f, h * 0.26f)
            lineTo(w * 0.60f, h * 0.50f)
            lineTo(w * 0.50f, h * 0.74f)
            lineTo(w * 0.40f, h * 0.50f)
            close()
        }
        drawPath(needle, color = tint, style = if (isFilled) Fill else Stroke(width = strokeW * 0.8f))
    }
}

@Composable
fun LibraryIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isFilled: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f

        // Bottom horizontal shelf / bar
        drawLine(color = tint, start = Offset(w * 0.16f, h * 0.82f), end = Offset(w * 0.84f, h * 0.82f), strokeWidth = strokeW, cap = StrokeCap.Round)

        // Three playlist / library cards
        val r = w * 0.04f
        drawRoundRect(color = tint, topLeft = Offset(w * 0.20f, h * 0.22f), size = Size(w * 0.15f, h * 0.54f), cornerRadius = CornerRadius(r, r), style = if (isFilled) Fill else Stroke(width = strokeW))
        drawRoundRect(color = tint, topLeft = Offset(w * 0.42f, h * 0.22f), size = Size(w * 0.15f, h * 0.54f), cornerRadius = CornerRadius(r, r), style = if (isFilled) Fill else Stroke(width = strokeW))

        // Tilted card
        val tilted = Path().apply {
            moveTo(w * 0.64f, h * 0.26f)
            lineTo(w * 0.78f, h * 0.32f)
            lineTo(w * 0.70f, h * 0.76f)
            lineTo(w * 0.58f, h * 0.70f)
            close()
        }
        drawPath(tilted, color = tint, style = if (isFilled) Fill else Stroke(width = strokeW, join = StrokeJoin.Round))
    }
}

@Composable
fun OfflineIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isFilled: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f

        // Folder outline
        val folder = Path().apply {
            moveTo(w * 0.18f, h * 0.34f)
            lineTo(w * 0.40f, h * 0.34f)
            lineTo(w * 0.48f, h * 0.42f)
            lineTo(w * 0.82f, h * 0.42f)
            lineTo(w * 0.82f, h * 0.80f)
            lineTo(w * 0.18f, h * 0.80f)
            close()
        }
        drawPath(folder, color = tint, style = if (isFilled) Fill else Stroke(width = strokeW, join = StrokeJoin.Round))

        // Inside down arrow
        val arrow = Path().apply {
            moveTo(w * 0.50f, h * 0.48f)
            lineTo(w * 0.50f, h * 0.68f)
        }
        drawPath(arrow, color = if (isFilled) Color.Black else tint, style = Stroke(width = strokeW, cap = StrokeCap.Round))
        val head = Path().apply {
            moveTo(w * 0.40f, h * 0.60f)
            lineTo(w * 0.50f, h * 0.70f)
            lineTo(w * 0.60f, h * 0.60f)
        }
        drawPath(head, color = if (isFilled) Color.Black else tint, style = Stroke(width = strokeW, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
fun PaletteIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f
        // Palette circle outline
        drawCircle(color = tint, center = Offset(w * 0.5f, h * 0.5f), radius = w * 0.38f, style = Stroke(width = strokeW))
        // 3 paint dots
        val r = w * 0.06f
        drawCircle(color = tint, center = Offset(w * 0.36f, h * 0.38f), radius = r)
        drawCircle(color = tint, center = Offset(w * 0.54f, h * 0.34f), radius = r)
        drawCircle(color = tint, center = Offset(w * 0.64f, h * 0.48f), radius = r)
    }
}

@Composable
fun SettingsIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f
        // Minimal horizontal slider controls icon
        drawLine(color = tint, start = Offset(w * 0.18f, h * 0.32f), end = Offset(w * 0.82f, h * 0.32f), strokeWidth = strokeW, cap = StrokeCap.Round)
        drawCircle(color = tint, center = Offset(w * 0.38f, h * 0.32f), radius = w * 0.11f)

        drawLine(color = tint, start = Offset(w * 0.18f, h * 0.68f), end = Offset(w * 0.82f, h * 0.68f), strokeWidth = strokeW, cap = StrokeCap.Round)
        drawCircle(color = tint, center = Offset(w * 0.62f, h * 0.68f), radius = w * 0.11f)
    }
}

@Composable
fun TimerIcon(
    modifier: Modifier = Modifier.size(24.dp),
    tint: Color = Color.White,
    isActive: Boolean = false
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val strokeW = w * 0.08f

        // Stopwatch circle
        drawCircle(color = tint, center = Offset(w * 0.50f, h * 0.54f), radius = w * 0.34f, style = Stroke(width = strokeW))

        // Top button
        drawLine(color = tint, start = Offset(w * 0.42f, h * 0.12f), end = Offset(w * 0.58f, h * 0.12f), strokeWidth = strokeW, cap = StrokeCap.Round)
        drawLine(color = tint, start = Offset(w * 0.50f, h * 0.12f), end = Offset(w * 0.50f, h * 0.20f), strokeWidth = strokeW, cap = StrokeCap.Round)

        // Clock hand
        drawLine(color = tint, start = Offset(w * 0.50f, h * 0.54f), end = Offset(w * 0.66f, h * 0.42f), strokeWidth = strokeW, cap = StrokeCap.Round)
    }
}
