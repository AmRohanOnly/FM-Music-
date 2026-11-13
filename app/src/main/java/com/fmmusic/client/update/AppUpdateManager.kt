package com.fmmusic.client.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.fmmusic.client.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class ReleaseUpdateInfo(
    val tagName: String,
    val versionName: String,
    val versionCode: Int?,
    val releaseTitle: String,
    val releaseNotes: String,
    val apkDownloadUrl: String,
    val releasePageUrl: String,
    val apkSizeBytes: Long,
    val publishedAt: String
) {
    val sizeFormatted: String
        get() {
            if (apkSizeBytes <= 0L) return "Unknown size"
            val mb = apkSizeBytes / (1024.0 * 1024.0)
            return String.format("%.1f MB", mb)
        }
}

data class AppUpdateUiState(
    val currentVersionName: String = BuildConfig.VERSION_NAME,
    val currentVersionCode: Int = BuildConfig.VERSION_CODE,
    val githubRepo: String = "",
    val isChecking: Boolean = false,
    val isDownloading: Boolean = false,
    val downloadProgress: Float = 0f,
    val availableUpdate: ReleaseUpdateInfo? = null,
    val showPromptDialog: Boolean = false,
    val upToDateMessage: String? = null,
    val errorMessage: String? = null,
    val needsInstallPermission: Boolean = false,
    val downloadedApkFile: File? = null
)

class AppUpdateManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val mutableState = MutableStateFlow(
        AppUpdateUiState(
            githubRepo = resolveInitialRepo()
        )
    )
    val state = mutableState.asStateFlow()

    private fun resolveInitialRepo(): String {
        val saved = prefs.getString(KEY_GITHUB_REPO, null)?.trim().orEmpty()
        if (saved.isNotBlank()) return saved
        return BuildConfig.GITHUB_REPO.trim()
    }

    fun setGithubRepo(repoSlug: String) {
        val cleaned = sanitizeRepoSlug(repoSlug)
        prefs.edit().putString(KEY_GITHUB_REPO, cleaned).apply()
        mutableState.update {
            it.copy(
                githubRepo = cleaned,
                errorMessage = null,
                upToDateMessage = null
            )
        }
    }

    fun dismissPrompt() {
        mutableState.update { it.copy(showPromptDialog = false) }
    }

    fun skipUpdateVersion(tagName: String) {
        prefs.edit().putString(KEY_SKIPPED_TAG, tagName).apply()
        mutableState.update {
            it.copy(
                showPromptDialog = false,
                availableUpdate = null
            )
        }
    }

    fun openPromptIfAvailable() {
        mutableState.update { cur ->
            if (cur.availableUpdate != null) cur.copy(showPromptDialog = true) else cur
        }
    }

    fun clearStatusMessages() {
        mutableState.update { it.copy(errorMessage = null, upToDateMessage = null) }
    }

    fun checkForUpdates(forceManual: Boolean = false) {
        val repo = mutableState.value.githubRepo.trim()
        if (repo.isBlank() || !repo.contains("/")) {
            if (forceManual) {
                mutableState.update {
                    it.copy(
                        isChecking = false,
                        errorMessage = "Enter your GitHub repository (owner/repo) to check for APK updates."
                    )
                }
            }
            return
        }

        if (mutableState.value.isChecking) return

        mutableState.update {
            it.copy(
                isChecking = true,
                errorMessage = null,
                upToDateMessage = null
            )
        }

        scope.launch {
            try {
                val release = withContext(Dispatchers.IO) {
                    fetchLatestGithubRelease(repo)
                }

                if (release == null) {
                    mutableState.update {
                        it.copy(
                            isChecking = false,
                            upToDateMessage = if (forceManual) "No APK releases found yet for $repo." else null
                        )
                    }
                    return@launch
                }

                val isNewer = isNewerVersion(
                    remoteVersionName = release.versionName,
                    remoteVersionCode = release.versionCode,
                    currentVersionName = BuildConfig.VERSION_NAME,
                    currentVersionCode = BuildConfig.VERSION_CODE
                )

                val skippedTag = prefs.getString(KEY_SKIPPED_TAG, null)

                if (isNewer) {
                    val shouldAutoShow = forceManual || skippedTag != release.tagName
                    mutableState.update {
                        it.copy(
                            isChecking = false,
                            availableUpdate = release,
                            showPromptDialog = shouldAutoShow,
                            upToDateMessage = null
                        )
                    }
                } else {
                    mutableState.update {
                        it.copy(
                            isChecking = false,
                            availableUpdate = null,
                            showPromptDialog = false,
                            upToDateMessage = if (forceManual) {
                                "You are on the latest version (v${BuildConfig.VERSION_NAME})."
                            } else null
                        )
                    }
                }
            } catch (e: Exception) {
                mutableState.update {
                    it.copy(
                        isChecking = false,
                        errorMessage = if (forceManual) {
                            e.message ?: "Could not check GitHub Releases for updates."
                        } else null
                    )
                }
            }
        }
    }

    fun downloadAndInstallUpdate(release: ReleaseUpdateInfo) {
        if (mutableState.value.isDownloading) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !context.packageManager.canRequestPackageInstalls()
        ) {
            mutableState.update {
                it.copy(
                    needsInstallPermission = true,
                    errorMessage = "Allow 'Install unknown apps' for FM Music, then tap Update Now again."
                )
            }
            openInstallPermissionSettings()
            return
        }

        mutableState.update {
            it.copy(
                isDownloading = true,
                downloadProgress = 0f,
                errorMessage = null,
                needsInstallPermission = false
            )
        }

        scope.launch {
            try {
                val apkFile = withContext(Dispatchers.IO) {
                    val updatesDir = File(context.cacheDir, "updates")
                    if (!updatesDir.exists()) updatesDir.mkdirs()
                    val outFile = File(updatesDir, "FM-Music-update.apk")
                    if (outFile.exists()) outFile.delete()

                    val conn = (URL(release.apkDownloadUrl).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 15000
                        readTimeout = 30000
                        instanceFollowRedirects = true
                        setRequestProperty("Accept", "application/octet-stream")
                        setRequestProperty("User-Agent", "FM-Music-Android/${BuildConfig.VERSION_NAME}")
                    }
                    conn.connect()

                    if (conn.responseCode !in 200..299) {
                        throw IllegalStateException("Download failed (HTTP ${conn.responseCode})")
                    }

                    val totalBytes = conn.contentLengthLong.takeIf { it > 0 } ?: release.apkSizeBytes
                    var downloaded = 0L

                    conn.inputStream.use { input ->
                        FileOutputStream(outFile).use { output ->
                            val buffer = ByteArray(16 * 1024)
                            while (true) {
                                val read = input.read(buffer)
                                if (read == -1) break
                                output.write(buffer, 0, read)
                                downloaded += read
                                if (totalBytes > 0L) {
                                    val progress = (downloaded.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
                                    mutableState.update { it.copy(downloadProgress = progress) }
                                }
                            }
                            output.flush()
                        }
                    }

                    if (!outFile.exists() || outFile.length() == 0L) {
                        throw IllegalStateException("Downloaded APK file was empty.")
                    }
                    outFile
                }

                mutableState.update {
                    it.copy(
                        isDownloading = false,
                        downloadProgress = 1f,
                        downloadedApkFile = apkFile
                    )
                }

                launchApkInstaller(apkFile)
            } catch (e: Exception) {
                mutableState.update {
                    it.copy(
                        isDownloading = false,
                        downloadProgress = 0f,
                        errorMessage = e.message ?: "Failed to download APK update."
                    )
                }
            }
        }
    }

    fun launchApkInstaller(apkFile: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(intent)
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun openInBrowser(url: String) {
        if (url.isBlank()) return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun fetchLatestGithubRelease(repo: String): ReleaseUpdateInfo? {
        val apiUrl = "https://api.github.com/repos/$repo/releases/latest"
        val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10000
            readTimeout = 10000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "FM-Music-Android/${BuildConfig.VERSION_NAME}")
        }
        conn.connect()

        if (conn.responseCode == 404) return null
        if (conn.responseCode !in 200..299) {
            throw IllegalStateException("GitHub API returned HTTP ${conn.responseCode}")
        }

        val bodyText = conn.inputStream.bufferedReader().use { it.readText() }
        val json = JSONObject(bodyText)

        val tagName = json.optString("tag_name", "").trim()
        val releaseTitle = json.optString("name", tagName).ifBlank { tagName }
        val releaseBody = json.optString("body", "").trim()
        val releasePageUrl = json.optString("html_url", "https://github.com/$repo/releases")
        val publishedAt = json.optString("published_at", "")
        val assets = json.optJSONArray("assets")

        var apkUrl = ""
        var apkSize = 0L
        var manifestUrl = ""

        if (assets != null) {
            for (i in 0 until assets.length()) {
                val asset = assets.optJSONObject(i) ?: continue
                val assetName = asset.optString("name", "")
                val downloadUrl = asset.optString("browser_download_url", "")
                if (assetName == "update-manifest.json" && downloadUrl.isNotBlank()) {
                    manifestUrl = downloadUrl
                } else if (assetName.endsWith(".apk", ignoreCase = true) && downloadUrl.isNotBlank()) {
                    // Prefer versioned APK over FM-Music-latest.apk if both exist
                    if (apkUrl.isBlank() || !assetName.contains("latest", ignoreCase = true)) {
                        apkUrl = downloadUrl
                        apkSize = asset.optLong("size", 0L)
                    }
                }
            }
        }

        var manifestVersionCode: Int? = null
        var manifestVersionName: String? = null
        var manifestNotes: String? = null

        if (manifestUrl.isNotBlank()) {
            try {
                val mConn = (URL(manifestUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 6000
                    readTimeout = 6000
                    instanceFollowRedirects = true
                }
                mConn.connect()
                if (mConn.responseCode in 200..299) {
                    val mJson = JSONObject(mConn.inputStream.bufferedReader().use { it.readText() })
                    if (mJson.has("versionCode")) {
                        manifestVersionCode = mJson.optInt("versionCode")
                    }
                    manifestVersionName = mJson.optString("versionName", "").takeIf { it.isNotBlank() }
                    manifestNotes = mJson.optString("releaseNotes", "").takeIf { it.isNotBlank() }
                    if (apkUrl.isBlank()) {
                        apkUrl = mJson.optString("apkUrl", "")
                    }
                    if (apkSize <= 0L && mJson.has("sizeBytes")) {
                        apkSize = mJson.optLong("sizeBytes", 0L)
                    }
                }
            } catch (_: Exception) {}
        }

        if (apkUrl.isBlank()) return null

        val cleanVersionName = (manifestVersionName ?: tagName).removePrefix("v").removePrefix("V")
        val cleanNotes = (manifestNotes ?: releaseBody)
            .ifBlank { "New Android APK update is available on GitHub." }

        return ReleaseUpdateInfo(
            tagName = tagName.ifBlank { "v$cleanVersionName" },
            versionName = cleanVersionName,
            versionCode = manifestVersionCode,
            releaseTitle = releaseTitle,
            releaseNotes = cleanNotes,
            apkDownloadUrl = apkUrl,
            releasePageUrl = releasePageUrl,
            apkSizeBytes = apkSize,
            publishedAt = publishedAt
        )
    }

    companion object {
        private const val PREFS_NAME = "fm_music_prefs"
        private const val KEY_GITHUB_REPO = "github_repo_slug"
        private const val KEY_SKIPPED_TAG = "skipped_update_tag"

        fun sanitizeRepoSlug(raw: String): String {
            var s = raw.trim()
                .removePrefix("https://github.com/")
                .removePrefix("http://github.com/")
                .removePrefix("github.com/")
                .removeSuffix(".git")
                .trim('/')
            val parts = s.split("/").filter { it.isNotBlank() }
            return if (parts.size >= 2) "${parts[0]}/${parts[1]}" else s
        }

        fun compareSemanticVersions(remote: String, current: String): Int {
            val rParts = remote.removePrefix("v").removePrefix("V")
                .split(Regex("[^0-9]+"))
                .filter { it.isNotBlank() }
                .mapNotNull { it.toIntOrNull() }
            val cParts = current.removePrefix("v").removePrefix("V")
                .split(Regex("[^0-9]+"))
                .filter { it.isNotBlank() }
                .mapNotNull { it.toIntOrNull() }

            val maxLen = maxOf(rParts.size, cParts.size)
            for (i in 0 until maxLen) {
                val r = rParts.getOrElse(i) { 0 }
                val c = cParts.getOrElse(i) { 0 }
                if (r != c) return r.compareTo(c)
            }
            return 0
        }

        fun isNewerVersion(
            remoteVersionName: String,
            remoteVersionCode: Int?,
            currentVersionName: String,
            currentVersionCode: Int
        ): Boolean {
            if (remoteVersionCode != null && remoteVersionCode > currentVersionCode) {
                return true
            }
            return compareSemanticVersions(remoteVersionName, currentVersionName) > 0
        }
    }
}
