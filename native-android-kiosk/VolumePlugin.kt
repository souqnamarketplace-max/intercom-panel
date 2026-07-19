package com.intercomplatform.panel

import android.content.Context
import android.media.AudioManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// Volume is the one Settings control that genuinely has no web equivalent -
// there's no browser API for system output volume. Brightness can be faked
// well enough with a CSS dim overlay (see displaySettings.ts); volume can't.
@CapacitorPlugin(name = "Volume")
class VolumePlugin : Plugin() {

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val level = call.getFloat("level", 0.7f)!!.coerceIn(0f, 1f)
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        audioManager.setStreamVolume(
            AudioManager.STREAM_MUSIC,
            (level * maxVolume).toInt(),
            0,
        )
        call.resolve()
    }

    @PluginMethod
    fun getVolume(call: PluginCall) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val result = JSObject()
        result.put("level", if (max > 0) current.toFloat() / max else 0f)
        call.resolve(result)
    }
}
