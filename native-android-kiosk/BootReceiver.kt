package com.intercomplatform.panel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Fires once the OS finishes booting and auto-launches the panel, so power-
// cycling the tablet (or a power outage) doesn't leave it sitting on the
// Android home screen - the whole point of a kiosk is nobody has to
// manually reopen the app after a restart.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launchIntent)
        }
    }
}
