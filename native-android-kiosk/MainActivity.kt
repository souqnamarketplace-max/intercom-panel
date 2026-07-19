package com.intercomplatform.panel

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    // Register any custom Capacitor plugins here before onCreate.
    init {
        registerPlugin(VolumePlugin::class.java)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enterImmersiveMode()
        startKioskLockIfDeviceOwner()
    }

    override fun onResume() {
        super.onResume()
        // Re-apply after any system UI interruption (e.g. a permission
        // dialog) tries to bring the status/nav bars back.
        enterImmersiveMode()
    }

    private fun enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    // Only actually locks the task if this app has been granted Device
    // Owner (see README step 5) - on a normal dev install without that,
    // this is a no-op rather than a crash, so you can still test everything
    // else before doing the one-time factory-reset provisioning step.
    private fun startKioskLockIfDeviceOwner() {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, AdminReceiver::class.java)
        if (dpm.isDeviceOwnerApp(packageName)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            }
            startLockTask()
        }
    }
}
