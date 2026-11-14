import java.io.File
import java.util.Base64
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val appVersionCode = (project.findProperty("FM_VERSION_CODE")?.toString()?.toIntOrNull()) ?: 1
val appVersionName = (project.findProperty("FM_VERSION_NAME")?.toString()?.takeIf { it.isNotBlank() }) ?: "1.0.0"
val githubRepo = (project.findProperty("FM_GITHUB_REPO")?.toString()?.takeIf { it.isNotBlank() }) ?: ""
val updateManifestUrl = (project.findProperty("FM_UPDATE_MANIFEST_URL")?.toString()?.takeIf { it.isNotBlank() }) ?: ""

android {
    namespace = "com.fmmusic.client"
    compileSdk = 37
    buildToolsVersion = "37.0.0"

    defaultConfig {
        applicationId = "com.fmmusic.client"
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "GITHUB_REPO", "\"${githubRepo.replace("\"", "\\\"")}\"")
        buildConfigField("String", "UPDATE_MANIFEST_URL", "\"${updateManifestUrl.replace("\"", "\\\"")}\"")
    }

    val envKeystorePath = System.getenv("FM_SIGN_KEYSTORE")?.trim()
    val resolvedEnvKeystore: File? = envKeystorePath
        ?.takeIf { it.isNotBlank() }
        ?.let { path -> File(path).let { if (it.isAbsolute) it else file("${rootDir}/$path") } }
        ?.takeIf { it.exists() }

    val resolvedDebugKeystore: File? = run {
        val rootDebug = file("${rootDir}/debug.keystore")
        val base64Debug = file("${rootDir}/debug.keystore.base64")
        val sdkDebug = File(System.getProperty("user.home"), ".android/debug.keystore")
        when {
            rootDebug.exists() -> rootDebug
            base64Debug.exists() -> {
                val outFile = layout.buildDirectory.file("signing/debug.keystore").get().asFile
                outFile.parentFile?.mkdirs()
                outFile.writeBytes(Base64.getMimeDecoder().decode(base64Debug.readText()))
                outFile
            }
            sdkDebug.exists() -> sdkDebug
            else -> null
        }
    }

    signingConfigs {
        if (resolvedDebugKeystore != null) {
            named("debug") {
                storeFile = resolvedDebugKeystore
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
        create("release") {
            val releaseKeystore = resolvedEnvKeystore ?: resolvedDebugKeystore
            if (releaseKeystore != null) {
                storeFile = releaseKeystore
                storePassword = if (resolvedEnvKeystore != null) {
                    System.getenv("FM_SIGN_STORE_PASS") ?: "android"
                } else {
                    "android"
                }
                keyAlias = if (resolvedEnvKeystore != null) {
                    System.getenv("FM_SIGN_KEY_ALIAS") ?: "androiddebugkey"
                } else {
                    "androiddebugkey"
                }
                keyPassword = if (resolvedEnvKeystore != null) {
                    System.getenv("FM_SIGN_KEY_PASS") ?: "android"
                } else {
                    "android"
                }
            }
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = if (resolvedEnvKeystore != null || resolvedDebugKeystore != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/INDEX.LIST",
                "META-INF/io.netty.versions.properties",
                "META-INF/AL2.0",
                "META-INF/LGPL2.1"
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.02.02")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("com.github.MetrolistGroup.innertubex:innertubex:v0.11.2")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("io.ktor:ktor-client-core:3.6.0")
    implementation("io.ktor:ktor-client-okhttp:3.6.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
