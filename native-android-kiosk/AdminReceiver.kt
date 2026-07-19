package com.intercomplatform.panel

import android.app.admin.DeviceAdminReceiver

// Required target for `adb shell dpm set-device-owner` - Android needs a
// real DeviceAdminReceiver subclass to grant Device Owner status to.
// Deliberately minimal - all the actual kiosk-lock behavior lives in
// MainActivity, this class just needs to exist and be declared correctly
// in the manifest (see AndroidManifest-additions.xml).
class AdminReceiver : DeviceAdminReceiver()
