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
    compileSdk = 35
    buildToolsVersion = "35.0.0"

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

    signingConfigs {
        named("debug") {
            storeFile = file("${rootDir}/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            val envKeystore = System.getenv("FM_SIGN_KEYSTORE")
            if (!envKeystore.isNullOrBlank() && file("${rootDir}/$envKeystore").exists()) {
                storeFile = file("${rootDir}/$envKeystore")
                storePassword = System.getenv("FM_SIGN_STORE_PASS") ?: "android"
                keyAlias = System.getenv("FM_SIGN_KEY_ALIAS") ?: "androiddebugkey"
                keyPassword = System.getenv("FM_SIGN_KEY_PASS") ?: "android"
            } else {
                storeFile = file("${rootDir}/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
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
