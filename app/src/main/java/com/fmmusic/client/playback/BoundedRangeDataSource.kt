package com.fmmusic.client.playback

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener

/**
 * A custom Media3 [DataSource] that partitions requests to googlevideo.com into bounded
 * range chunks (256 KB).
 *
 * YouTube's CDN rejects unbounded requests (Range: bytes=0- or missing Range) with HTTP 403 Forbidden.
 * By enforcing bounded ranges for every chunk request, playback streams seamlessly without 403 errors,
 * and tracks play to completion without premature termination or seek crashes.
 */
@OptIn(UnstableApi::class)
class BoundedRangeDataSource(
    private val upstreamFactory: DataSource.Factory,
    private val chunkSize: Long = DEFAULT_CHUNK_SIZE
) : DataSource {

    private var currentUpstream: DataSource? = null
    private var originalDataSpec: DataSpec? = null
    private var currentPosition: Long = 0L
    private var bytesToReadTotal: Long = C.LENGTH_UNSET.toLong()
    private var totalStreamLength: Long = C.LENGTH_UNSET.toLong()
    private var bytesRemainingInCurrentChunk: Long = 0L
    private var isClosed = true
    private val listeners = mutableListOf<TransferListener>()

    override fun addTransferListener(transferListener: TransferListener) {
        listeners.add(transferListener)
        currentUpstream?.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
        originalDataSpec = dataSpec
        currentPosition = dataSpec.position
        bytesToReadTotal = dataSpec.length
        isClosed = false

        val uriString = dataSpec.uri.toString()
        val isGoogleVideo = uriString.contains("googlevideo.com")

        if (!isGoogleVideo) {
            val upstream = upstreamFactory.createDataSource()
            listeners.forEach { upstream.addTransferListener(it) }
            currentUpstream = upstream
            return upstream.open(dataSpec)
        }

        // Open first chunk with bounded range: [currentPosition, currentPosition + chunkSize - 1]
        val firstChunkLength = if (bytesToReadTotal != C.LENGTH_UNSET.toLong()) {
            minOf(chunkSize, bytesToReadTotal)
        } else {
            chunkSize
        }

        val firstChunkSpec = dataSpec.buildUpon()
            .setPosition(currentPosition)
            .setLength(firstChunkLength)
            .build()

        val upstream = upstreamFactory.createDataSource()
        listeners.forEach { upstream.addTransferListener(it) }
        currentUpstream = upstream
        val openedBytes = upstream.open(firstChunkSpec)
        bytesRemainingInCurrentChunk = if (openedBytes > 0) openedBytes else firstChunkLength

        // Parse total stream length from Content-Range header (e.g. bytes 0-262143/4557665)
        val responseHeaders = upstream.responseHeaders
        val contentRangeList = responseHeaders["Content-Range"] ?: responseHeaders["content-range"]
        val contentRangeHeader = contentRangeList?.firstOrNull()
        if (!contentRangeHeader.isNullOrBlank() && contentRangeHeader.contains("/")) {
            val totalStr = contentRangeHeader.substringAfter("/").trim()
            totalStreamLength = totalStr.toLongOrNull() ?: C.LENGTH_UNSET.toLong()
        }

        return if (bytesToReadTotal != C.LENGTH_UNSET.toLong()) {
            bytesToReadTotal
        } else if (totalStreamLength != C.LENGTH_UNSET.toLong()) {
            (totalStreamLength - currentPosition).coerceAtLeast(0L)
        } else {
            C.LENGTH_UNSET.toLong()
        }
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        if (currentUpstream == null) return C.RESULT_END_OF_INPUT

        val uriString = originalDataSpec?.uri?.toString().orEmpty()
        if (!uriString.contains("googlevideo.com")) {
            return currentUpstream?.read(buffer, offset, length) ?: C.RESULT_END_OF_INPUT
        }

        // When current chunk is exhausted, advance and open the next bounded chunk
        while (bytesRemainingInCurrentChunk <= 0L) {
            if (totalStreamLength != C.LENGTH_UNSET.toLong() && currentPosition >= totalStreamLength) {
                return C.RESULT_END_OF_INPUT
            }
            if (bytesToReadTotal != C.LENGTH_UNSET.toLong() && currentPosition >= (originalDataSpec!!.position + bytesToReadTotal)) {
                return C.RESULT_END_OF_INPUT
            }

            try {
                currentUpstream?.close()
            } catch (_: Exception) {}

            val nextChunkLength = if (totalStreamLength != C.LENGTH_UNSET.toLong()) {
                val remainingTotal = totalStreamLength - currentPosition
                minOf(chunkSize, remainingTotal)
            } else if (bytesToReadTotal != C.LENGTH_UNSET.toLong()) {
                val remainingTotal = (originalDataSpec!!.position + bytesToReadTotal) - currentPosition
                minOf(chunkSize, remainingTotal)
            } else {
                chunkSize
            }

            if (nextChunkLength <= 0) {
                return C.RESULT_END_OF_INPUT
            }

            val nextSpec = originalDataSpec!!.buildUpon()
                .setPosition(currentPosition)
                .setLength(nextChunkLength)
                .build()

            var attempts = 0
            var opened = false

            while (attempts < 3 && !opened) {
                attempts++
                try {
                    val nextUpstream = upstreamFactory.createDataSource()
                    listeners.forEach { nextUpstream.addTransferListener(it) }
                    val chunkOpened = nextUpstream.open(nextSpec)
                    currentUpstream = nextUpstream
                    bytesRemainingInCurrentChunk = if (chunkOpened > 0) chunkOpened else nextChunkLength
                    opened = true

                    if (totalStreamLength == C.LENGTH_UNSET.toLong()) {
                        val respHeaders = nextUpstream.responseHeaders
                        val crList = respHeaders["Content-Range"] ?: respHeaders["content-range"]
                        val cr = crList?.firstOrNull()
                        if (!cr.isNullOrBlank() && cr.contains("/")) {
                            val totalStr = cr.substringAfter("/").trim()
                            totalStreamLength = totalStr.toLongOrNull() ?: C.LENGTH_UNSET.toLong()
                        }
                    }
                } catch (e: Exception) {
                    if (attempts >= 3) throw e
                    try {
                        Thread.sleep(100L * attempts)
                    } catch (_: InterruptedException) {}
                }
            }
        }

        val toRead = minOf(length.toLong(), bytesRemainingInCurrentChunk).toInt()
        val bytesRead = currentUpstream?.read(buffer, offset, toRead) ?: C.RESULT_END_OF_INPUT

        if (bytesRead > 0) {
            bytesRemainingInCurrentChunk -= bytesRead
            currentPosition += bytesRead
        } else if (bytesRead == C.RESULT_END_OF_INPUT) {
            // End of this chunk: do NOT declare entire stream finished unless totalStreamLength is reached
            bytesRemainingInCurrentChunk = 0L
            if (totalStreamLength != C.LENGTH_UNSET.toLong() && currentPosition >= totalStreamLength) {
                return C.RESULT_END_OF_INPUT
            }
        }

        return bytesRead
    }

    override fun getUri(): Uri? = currentUpstream?.uri ?: originalDataSpec?.uri

    override fun getResponseHeaders(): Map<String, List<String>> =
        currentUpstream?.responseHeaders ?: emptyMap()

    override fun close() {
        if (!isClosed) {
            isClosed = true
            try {
                currentUpstream?.close()
            } catch (_: Exception) {}
            currentUpstream = null
            originalDataSpec = null
            bytesRemainingInCurrentChunk = 0L
        }
    }

    companion object {
        const val DEFAULT_CHUNK_SIZE: Long = 256 * 1024L // 256 KB bounded chunk
    }
}

@OptIn(UnstableApi::class)
class BoundedRangeDataSourceFactory(
    private val upstreamFactory: DataSource.Factory,
    private val chunkSize: Long = BoundedRangeDataSource.DEFAULT_CHUNK_SIZE
) : DataSource.Factory {
    override fun createDataSource(): DataSource {
        return BoundedRangeDataSource(upstreamFactory, chunkSize)
    }
}
