package com.fmmusic.client

import android.app.Application
import android.util.Log
import com.fmmusic.client.network.MusicNetworkClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MusicApplication : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var networkClient: MusicNetworkClient
        private set

    private val mutablePublicSessionReady = MutableStateFlow(false)
    val publicSessionReady = mutablePublicSessionReady.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        networkClient = MusicNetworkClient()
        applicationScope.launch {
            try {
                mutablePublicSessionReady.value = networkClient.initializePublicSession()
                if (!mutablePublicSessionReady.value) {
                    Log.w(TAG, "Public browsing visitor session could not be established.")
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e(TAG, "Public browsing visitor session initialization failed.", error)
            }
        }
    }

    private companion object {
        const val TAG = "MusicApplication"
    }
}
