package com.proofofready.seeker;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.hardware.camera2.*;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.*;
import android.util.AtomicFile;
import android.util.Size;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity implements TextureView.SurfaceTextureListener {
    private static final int CAMERA_PERMISSION = 701, BLE_PERMISSION = 702;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final BleInspector ble = new BleInspector();
    private RequestLedger ledger;
    private LinearLayout page;
    private EditText portInput, sessionInput, challengeInput, addressInput, providerInput;
    private TextView status, keyText;
    private Button armButton, captureButton, uploadButton;
    private TextureView preview;
    private WebView station;
    private PermissionRequest webCameraRequest;
    private CameraDevice camera;
    private CameraCaptureSession cameraSession;
    private ImageReader reader;
    private JSONObject challenge;
    private boolean opening, previewReady, capturing, resumed, destroyed;
    private long generation, requestElapsed;
    private Runnable expiry;
    private Surface previewSurface;
    private int tab = 1, port = 4022;
    private String completedId;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); ledger = new RequestLedger(this);
        port = getPreferences(MODE_PRIVATE).getInt("coordinator-port", 4022);
        if (state != null) tab = state.getInt("tab", 1);
                layout(tab);
        String extra = getIntent().getStringExtra("challenge");
        if (extra != null && challengeInput != null) challengeInput.setText(extra);
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("tab", tab); super.onSaveInstanceState(state); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView label(String text, int size, boolean bold) {
        TextView value = new TextView(this); value.setText(text); value.setTextSize(size); value.setTextColor(Color.rgb(29,42,64)); value.setPadding(0,dp(7),0,dp(7));
        if (bold) value.setTypeface(null, Typeface.BOLD); return value;
    }
    private Button button(String text, View.OnClickListener listener) { Button value = new Button(this); value.setText(text); value.setAllCaps(false); value.setOnClickListener(listener); page.addView(value); return value; }
    private EditText field(String hint, String text, int id) { EditText value = new EditText(this); value.setHint(hint); value.setText(text); value.setId(id); value.setSingleLine(true); value.setTextSize(14); page.addView(value); return value; }
    private void say(String message) { if (!destroyed && status != null) status.setText(message); }
    private void layout(int next) {
        releaseCamera("INTERRUPTED"); ble.close(); destroyStation(); tab = next;
        LinearLayout shell = new LinearLayout(this); shell.setOrientation(LinearLayout.VERTICAL); shell.setBackgroundColor(Color.rgb(243,245,248)); shell.setPadding(dp(16),dp(12),dp(16),dp(12));
        shell.setOnApplyWindowInsetsListener((view,insets) -> {
            int left,top,right,bottom;
            if (Build.VERSION.SDK_INT >= 30) { android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout()); left=bars.left; top=bars.top; right=bars.right; bottom=bars.bottom; }
            else { left=insets.getSystemWindowInsetLeft(); top=insets.getSystemWindowInsetTop(); right=insets.getSystemWindowInsetRight(); bottom=insets.getSystemWindowInsetBottom(); }
            view.setPadding(dp(16)+left,dp(12)+top,dp(16)+right,dp(12)+bottom); return insets;
        });
        shell.addView(label("signoff · Seeker companion",22,true));
        LinearLayout navigation = new LinearLayout(this);
        for (int index = 0; index < 3; index++) { final int selected = index; Button item = new Button(this); item.setText(new String[]{"Station","Phone witness","BLE preflight"}[index]); item.setAllCaps(false); item.setTextSize(11); item.setOnClickListener(view -> layout(selected)); navigation.addView(item,new LinearLayout.LayoutParams(0,-2,1)); }
        shell.addView(navigation);
        ScrollView scroll = new ScrollView(this); page = new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); scroll.addView(page); shell.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(shell); shell.requestApplyInsets();
        status = label("",14,false);
        if (next == 0) stationPage(); else if (next == 1) witnessPage(); else blePage();
    }
    private int selectedPort() {
        String value = portInput.getText().toString(); if (!value.matches("[0-9]{4,5}")) throw new IllegalArgumentException("Use the local coordinator port.");
        int selected = Integer.parseInt(value); Protocol.newOrigin(selected); port = selected; getPreferences(MODE_PRIVATE).edit().putInt("coordinator-port",port).apply(); return port;
    }
    private void portField() { portInput = field("Local coordinator port",Integer.toString(port),101); portInput.setInputType(android.text.InputType.TYPE_CLASS_NUMBER); }
    private void stationPage() {
        page.addView(label("Open the same commissioning station through USB forwarding. Only the selected loopback origin can load. Native signing has no JavaScript bridge.",14,false)); portField();
        button("Open commissioning station", view -> { try { openStation(selectedPort()); } catch (Exception error) { say(error.getMessage()); } });
        page.addView(status); station = new WebView(this); page.addView(station,new LinearLayout.LayoutParams(-1,dp(740)));
        WebSettings settings = station.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false); settings.setMediaPlaybackRequiresUserGesture(true); settings.setGeolocationEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(station,false); WebView.setWebContentsDebuggingEnabled(false);
        station.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { boolean blocked = !Protocol.trustedUrl(request.getUrl().toString(),port); if (blocked) say("Navigation blocked. Keep the station on its selected local origin."); return blocked; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { if (Protocol.trustedUrl(request.getUrl().toString(),port)) return null; return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream("Only the selected local origin is permitted.".getBytes(StandardCharsets.UTF_8))); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { if (request.isForMainFrame()) say("Local station unavailable. Check USB forwarding and the selected coordinator port."); }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
        });
        station.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                main.post(() -> {
                    if (!resumed || !Protocol.trustedOrigin(request.getOrigin().toString(),port) || request.getResources().length != 1 || !PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0])) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    else { if (webCameraRequest != null) webCameraRequest.deny(); webCameraRequest = request; requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_PERMISSION); }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (webCameraRequest == request) webCameraRequest = null; }
        });
        say("Select Open commissioning station after USB forwarding is ready.");
    }
    private void openStation(int selectedPort) { if (station == null) return; denyWebPermission(); station.loadUrl(Protocol.newOrigin(selectedPort) + "/"); say("Local station " + Protocol.newOrigin(selectedPort) + ". Camera permission applies only to this origin."); }
    private void witnessPage() {
        page.addView(label("A fresh signed photo binds this phone key to one approved work order and capture request. Photos stay in private app storage. The signature does not attest camera origin or installation truth.",14,false));
        portField(); sessionInput = field("Capture identifier · 16 lowercase hex", "",102);
        button("Load request from station", view -> {
            try {
                int selected = selectedPort(); String id = sessionInput.getText().toString().trim();
                if (!id.matches("[0-9a-f]{16}")) throw new IllegalArgumentException("Enter the original capture identifier.");
                say("Loading the original phone request. No camera operation starts.");
                network.execute(() -> { try { JSONObject value = new CoordinatorClient(selected).phoneChallenge(id); main.post(() -> { if (tab == 1 && challengeInput != null) { challengeInput.setText(value.toString()); say("Request loaded. Review it, then arm one photo."); } }); } catch (Exception error) { main.post(() -> say(safeNetwork(error))); } });
            } catch (Exception error) { say(error.getMessage()); }
        });
        challengeInput = field("Paste original phone challenge JSON", "",103); challengeInput.setSingleLine(false); challengeInput.setMinLines(3); challengeInput.setMaxLines(6); challengeInput.setTextSize(11);
        armButton = button("Arm one photo", view -> armPhoto()); captureButton = button("Capture requested photo",view -> capturePhoto()); captureButton.setEnabled(false);
        uploadButton = button("Send signed envelope to station", view -> submitEnvelope());
        completedId = ledger.latestId(); uploadButton.setEnabled(completedId != null);
        preview = new TextureView(this); preview.setSurfaceTextureListener(this); page.addView(preview,new LinearLayout.LayoutParams(-1,dp(220)));
        page.addView(status); keyText = label("",11,false); keyText.setTextIsSelectable(true); page.addView(keyText);
        try {
            String pin = PhoneIdentity.publicKey(); JSONObject publicInfo = new JSONObject(); publicInfo.put("publicKeySec1Hex",pin); publicInfo.put("provider","seeker-inspector"); publicInfo.put("keySecurityLevel",PhoneIdentity.securityLevel());
            writeAtomic(new File(getFilesDir(),"phone-public-key.json"),publicInfo.toString(2).getBytes(StandardCharsets.UTF_8));
            keyText.setText("Enroll this public P-256 pin through a trusted transfer:\n" + pin + "\nKey security metadata: " + PhoneIdentity.securityLevel() + ". This is not remote attestation.\nDevice: " + Build.MANUFACTURER + " " + Build.MODEL);
        } catch (Exception error) { say("The phone Keystore key is unavailable. No capture can be signed."); armButton.setEnabled(false); }
    }
    private static String safeNetwork(Exception error) {
        if (error instanceof IllegalStateException || error instanceof IllegalArgumentException) return error.getMessage();
        return "The local coordinator request failed. Check USB forwarding and stored coordinator state before another request.";
    }
    private void armPhoto() {
        if (challenge != null || capturing || opening) { say("The original photo request is pending. Complete it or start a new coordinator attempt."); return; }
        try {
            JSONObject original = Protocol.challenge(challengeInput.getText().toString(),System.currentTimeMillis()/1000);
            ledger.reserve(original); challenge = original; requestElapsed = SystemClock.elapsedRealtimeNanos(); armButton.setEnabled(false); uploadButton.setEnabled(false);
            final long expected = generation;
            expiry = () -> { if (generation == expected && challenge != null) { releaseCamera("EXPIRED"); say("The original photo window expired. Start a new coordinator attempt."); } };
            main.postDelayed(expiry, Math.max(1,(original.getLong("expires_at") + 1)*1000 - System.currentTimeMillis()));
            say("Original request reserved. Capture one photo before its deadline. A restart will not repeat it.");
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_PERMISSION); else openCamera();
        } catch (Exception error) { say(error.getMessage()); }
    }
    private void submitEnvelope() {
        try {
            final JSONObject envelope = ledger.completed(completedId); final int selected = selectedPort(); uploadButton.setEnabled(false); say("Sending the signed envelope. The JPEG stays on this phone.");
            network.execute(() -> { try { new CoordinatorClient(selected).submit(envelope); main.post(() -> say("Signed envelope delivered. The coordinator checks its original request and enrolled key. The JPEG stays private.")); } catch (Exception error) { main.post(() -> say(safeNetwork(error))); } finally { main.post(() -> { if (uploadButton != null) uploadButton.setEnabled(completedId != null); }); } });
        } catch (Exception error) { say(error.getMessage()); }
    }
    private void blePage() {
        page.addView(label("Read only the configured board manifest. This preflight does not authenticate the board or prove sensor function. No scan, characteristic write, or actuator command runs.",14,false));
        addressInput = field("Configured Bluetooth address", "",104); providerInput = field("Configured provider identifier", "",105);
        button("Read configured BLE manifest",view -> {
            if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},BLE_PERMISSION); return; }
            readBle();
        }); page.addView(status);
    }
    private void readBle() { try { say("Reading one configured manifest. No automatic retry runs."); ble.read(this,addressInput.getText().toString().trim(),providerInput.getText().toString().trim(),(manifest,error)->say(error != null ? error : "Manifest read for " + manifest.optString("device_id") + ". Match the enrolled key before requesting signed observations.")); } catch (Exception error) { say(error.getMessage()); } }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(requestCode,permissions,results);
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == CAMERA_PERMISSION) {
            if (webCameraRequest != null) { PermissionRequest request = webCameraRequest; webCameraRequest = null; if (granted && resumed && station != null && Protocol.trustedUrl(station.getUrl(),port) && Protocol.trustedOrigin(request.getOrigin().toString(),port)) request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else request.deny(); }
            else if (granted && challenge != null && resumed) openCamera();
            else if (challenge != null) { releaseCamera("PERMISSION_DENIED"); say("Camera permission denied. Start a new coordinator attempt before another capture."); }
        } else if (requestCode == BLE_PERMISSION) { if (granted && tab == 2) readBle(); else say("Nearby-device permission denied. No BLE operation ran."); }
    }
    private void denyWebPermission() { if (webCameraRequest != null) { webCameraRequest.deny(); webCameraRequest = null; } }
    private Size chooseSize(Size[] sizes) { if (sizes == null) throw new IllegalStateException("The camera output sizes are unavailable."); Size best = null; for (Size size : sizes) if (size.getWidth() <= 1920 && size.getHeight() <= 1080 && (best == null || (long)size.getWidth()*size.getHeight() > (long)best.getWidth()*best.getHeight())) best = size; if (best == null) throw new IllegalStateException("No bounded camera output is available."); return best; }
    private void openCamera() {
        if (!resumed || tab != 1 || challenge == null || camera != null || opening || preview == null || !preview.isAvailable() || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return;
        final long expected = generation; opening = true;
        try {
            CameraManager manager = (CameraManager)getSystemService(CAMERA_SERVICE); String selected = null;
            for (String id : manager.getCameraIdList()) if (manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK) { selected = id; break; }
            if (selected == null) throw new IllegalStateException("No rear camera is available.");
            StreamConfigurationMap map = manager.getCameraCharacteristics(selected).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            if (map == null) throw new IllegalStateException("The camera output map is unavailable.");
            Size jpeg = chooseSize(map.getOutputSizes(ImageFormat.JPEG)), image = chooseSize(map.getOutputSizes(SurfaceTexture.class)); preview.getSurfaceTexture().setDefaultBufferSize(image.getWidth(),image.getHeight());
            reader = ImageReader.newInstance(jpeg.getWidth(),jpeg.getHeight(),ImageFormat.JPEG,2); reader.setOnImageAvailableListener(source -> photoAvailable(source,expected),main);
            manager.openCamera(selected,new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice opened) { if (generation != expected || !resumed || challenge == null) { opened.close(); return; } opening = false; camera = opened; startPreview(expected); }
                @Override public void onDisconnected(CameraDevice opened) { opened.close(); if (generation == expected) { releaseCamera("CAMERA_DISCONNECTED"); say("Camera disconnected. Start a new coordinator attempt."); } }
                @Override public void onError(CameraDevice opened,int error) { opened.close(); if (generation == expected) { releaseCamera("CAMERA_FAILED"); say("Camera failed. Start a new coordinator attempt."); } }
            },main);
        } catch (Exception error) { releaseCamera("CAMERA_FAILED"); say("The camera could not start. Start a new coordinator attempt after checking camera availability."); }
    }
    private void startPreview(long expected) {
        try {
            Surface surface = new Surface(preview.getSurfaceTexture()); previewSurface = surface; CaptureRequest.Builder request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW); request.addTarget(surface);
            camera.createCaptureSession(new android.hardware.camera2.params.SessionConfiguration(android.hardware.camera2.params.SessionConfiguration.SESSION_REGULAR, Arrays.asList(new android.hardware.camera2.params.OutputConfiguration(surface),new android.hardware.camera2.params.OutputConfiguration(reader.getSurface())), main::post, new CameraCaptureSession.StateCallback() {
                @Override public void onConfigured(CameraCaptureSession value) { if (generation != expected || !resumed || camera == null) { value.close(); return; } cameraSession = value; try { value.setRepeatingRequest(request.build(),null,main); previewReady = true; captureButton.setEnabled(challenge != null); } catch (CameraAccessException error) { releaseCamera("CAMERA_FAILED"); say("Camera preview failed. Start a new coordinator attempt."); } }
                @Override public void onConfigureFailed(CameraCaptureSession value) { if (generation == expected) { releaseCamera("CAMERA_FAILED"); say("Camera session failed. Start a new coordinator attempt."); } }
            }));
        } catch (Exception error) { releaseCamera("CAMERA_FAILED"); say("The camera preview is unavailable."); }
    }
    private void capturePhoto() {
        if (!resumed || !previewReady || challenge == null || capturing || cameraSession == null) return;
        try {
            Protocol.challenge(challenge.toString(),System.currentTimeMillis()/1000); ledger.transition(challenge.getString("request_id"),"RESERVED","CAPTURING",null); capturing = true; captureButton.setEnabled(false);
            CaptureRequest.Builder request = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE); request.addTarget(reader.getSurface());
            final long expected = generation;
            cameraSession.capture(request.build(),new CameraCaptureSession.CaptureCallback() { @Override public void onCaptureFailed(CameraCaptureSession session,CaptureRequest request,CaptureFailure failure) { if (expected == generation) { releaseCamera("CAMERA_FAILED"); say("Photo capture failed. The original request stays consumed."); } } },main);
        } catch (Exception error) { releaseCamera("CAPTURE_FAILED"); say("The capture request failed or expired. Start a new coordinator attempt."); }
    }
    private static void writeAtomic(File file,byte[] bytes) throws Exception {
        AtomicFile target = new AtomicFile(file); FileOutputStream output = null;
        try { output = target.startWrite(); output.write(bytes); target.finishWrite(output); }
        catch (Exception error) { if (output != null) target.failWrite(output); throw error; }
    }
    private void photoAvailable(ImageReader source,long expected) {
        Image image = null;
        try {
            if (expected != generation || !capturing || challenge == null) return;
            image = source.acquireNextImage(); if (image == null) return;
            ByteBuffer buffer = image.getPlanes()[0].getBuffer(); if (buffer.remaining() > 12*1024*1024 || SystemClock.elapsedRealtimeNanos() <= requestElapsed) throw new IllegalStateException("The photo bytes or capture order are invalid.");
            byte[] jpeg = new byte[buffer.remaining()]; buffer.get(jpeg); JSONObject envelope = PhoneIdentity.signPhoto(challenge,jpeg,System.currentTimeMillis()/1000);
            File directory = new File(getFilesDir(),"photos"); if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Private photo storage is unavailable.");
            String id = challenge.getString("request_id"); writeAtomic(new File(directory,id+".jpg"),jpeg); writeAtomic(new File(directory,id+".json"),(envelope.toString(2)+"\n").getBytes(StandardCharsets.UTF_8));
            ledger.transition(id,"CAPTURING","COMPLETE",envelope); completedId = id; challenge = null; releaseCamera(null);
            uploadButton.setEnabled(true); say("Photo and signed envelope saved privately. Send only the envelope when ready. A duplicate request cannot capture again.");
        } catch (Exception error) { releaseCamera("CAPTURE_FAILED"); say("Photo evidence failed. The original request stays consumed. Start a new coordinator attempt."); }
        finally { if (image != null) image.close(); }
    }
    private void releaseCamera(String reason) {
        generation++; if (expiry != null) { main.removeCallbacks(expiry); expiry = null; } opening = false; previewReady = false; capturing = false;
        if (challenge != null && reason != null && ledger != null) {
            try { String id = challenge.getString("request_id"); String state = ledger.state(id); if ("RESERVED".equals(state) || "CAPTURING".equals(state)) ledger.transition(id,state,reason,null); } catch (Exception error) { say("The original request remains fenced in the phone ledger."); }
        }
        challenge = null; if (captureButton != null) captureButton.setEnabled(false); if (armButton != null) armButton.setEnabled(true);
        if (cameraSession != null) { cameraSession.close(); cameraSession = null; } if (camera != null) { camera.close(); camera = null; } if (reader != null) { reader.close(); reader = null; } if (previewSurface != null) { previewSurface.release(); previewSurface = null; }
    }
    private void destroyStation() { denyWebPermission(); if (station != null) { station.stopLoading(); station.loadUrl("about:blank"); station.destroy(); station = null; } }
    @Override protected void onResume() { super.onResume(); resumed = true; if (station != null) station.onResume(); }
    @Override protected void onPause() { resumed = false; releaseCamera("INTERRUPTED"); ble.close(); denyWebPermission(); if (station != null) { station.onPause(); station.loadUrl("about:blank"); } super.onPause(); }
    @Override protected void onDestroy() { destroyed = true; releaseCamera("INTERRUPTED"); ble.close(); destroyStation(); network.shutdownNow(); ledger.close(); super.onDestroy(); }
    @Override public void onSurfaceTextureAvailable(SurfaceTexture surface,int width,int height) { openCamera(); }
    @Override public void onSurfaceTextureSizeChanged(SurfaceTexture surface,int width,int height) { if (challenge != null) { releaseCamera("CAMERA_CHANGED"); say("Camera geometry changed. Start a new coordinator attempt."); } }
    @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) { releaseCamera("INTERRUPTED"); return true; }
    @Override public void onSurfaceTextureUpdated(SurfaceTexture surface) { }
}
