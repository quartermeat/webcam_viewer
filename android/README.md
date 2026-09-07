# Human Interface Phone

This is the Android companion for the LAN camera/processed-preview path. It is
intentionally a small hardware-accelerated WebView shell around `phone.html`,
so signaling and visual behavior stay shared with the browser client.

## Build and install

Open this directory in Android Studio, select the `app` run configuration, and
deploy to a USB-debuggable phone. With a local Gradle installation:

```bash
gradle -p android assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The app defaults to the current workstation address. To override it without
rebuilding:

```bash
adb shell am start -n com.quartermeat.humaninterface/.MainActivity \
  --es server_url https://WORKSTATION_IP:8443/phone.html
```

The debug build accepts the project's self-signed HTTPS certificate. Keep the
phone and workstation on the same trusted LAN; release builds reject that
certificate until a trusted certificate strategy is added.
