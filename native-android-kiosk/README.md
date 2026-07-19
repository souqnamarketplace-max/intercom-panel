# Android Kiosk Mode — Setup Guide

This folder has real, complete native Android files for turning the panel into a
locked-down kiosk (boots straight to the app, no way to back out to Android, no
one can tell it's a tablet). They're **not wired into a live Android project
yet** — that step needs `npx cap add android`, which needs Android Studio /
the Android SDK on your machine. My sandbox can't reach Google's servers to
install that, so this is the one part of this work you have to run locally.

## 1. Generate the native project (on your Mac, with Android Studio installed)

```bash
cd panel
npm install
npm run build
npx cap add android
npx cap sync
```

This creates a real `android/` folder with a full Gradle project inside it.

## 2. Drop in the files from this folder

| File here | Goes to |
|---|---|
| `MainActivity.kt` | `android/app/src/main/java/com/intercomplatform/panel/MainActivity.kt` (replace the generated one) |
| `BootReceiver.kt` | same package, new file |
| `VolumePlugin.kt` | same package, new file |
| `AndroidManifest-additions.xml` | merge the snippets into `android/app/src/main/AndroidManifest.xml` |

## 3. Register the volume plugin

In `MainActivity.kt` (already done in the version here), register `VolumePlugin`
before `super.onCreate()`. Then from the web side:

```ts
import { registerPlugin } from '@capacitor/core';
const Volume = registerPlugin<{ setVolume(opts: { level: number }): Promise<void> }>('Volume');
await Volume.setVolume({ level: 0.7 }); // 0.0–1.0
```

## 4. Build and install once, normally

```bash
npx cap open android
```

Build and run to the tablet via USB like any Android app, **before** doing
Device Owner provisioning (step 5 requires no other accounts/apps on the
device yet).

## 5. Device Owner provisioning (the actual kiosk lockdown)

This has to happen on a **factory-reset tablet, before adding any Google
account** — Device Owner mode can't be granted otherwise.

```bash
adb shell dpm set-device-owner com.intercomplatform.panel/.AdminReceiver
```

If that succeeds, the app is now Device Owner and `startLockTask()` (already
called in `MainActivity.kt`) will actually pin the app — no home button, no
recents, no notification shade, no way out.

## 6. Set the app as the default launcher + boot-on-power

`BootReceiver.kt` handles auto-launching after boot. To make it the actual
home screen (so there's no launcher to accidentally reveal), on the tablet:
Settings → Apps → Default apps → Home app → Intercom Panel.

## What this gets you

Power on the tablet → it boots straight into the panel app → fullscreen,
immersive (no status/nav bar) → no way to exit, switch apps, or reach Android
settings → indistinguishable from purpose-built intercom hardware.

## Known limitation

Volume and screen brightness control need the `Volume` plugin above (volume)
and a similar native brightness plugin (not included yet — brightness in the
app itself currently uses a CSS dim overlay, not real hardware backlight
control, since that needs `WRITE_SETTINGS` permission handling I haven't
built). Ask if you want that added once you're at this stage.
