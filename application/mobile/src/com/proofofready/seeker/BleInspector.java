package com.proofofready.seeker;

import android.bluetooth.*;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Read-only preflight. This class contains no characteristic write or actuation path. */
public final class BleInspector {
    public static final UUID SERVICE = UUID.fromString("0000cb00-0000-1000-8000-00805f9b34fb");
    public static final UUID MANIFEST = UUID.fromString("0000cb01-0000-1000-8000-00805f9b34fb");
    public interface Result { void complete(JSONObject manifest, String error); }
    private final Handler main = new Handler(Looper.getMainLooper());
    private BluetoothGatt connection;
    private Result result;
    private long generation;
    public void close() { generation++; if (connection != null) { connection.disconnect(); connection.close(); connection = null; } result = null; }
    private void finish(long expected, JSONObject manifest, String error) {
        if (generation != expected || result == null) return;
        Result callback = result; close(); callback.complete(manifest, error);
    }
    public void read(Context context, String address, String provider, Result callback) {
        if (connection != null) throw new IllegalStateException("The original BLE read is still pending.");
        if (!BluetoothAdapter.checkBluetoothAddress(address) || !provider.matches("[A-Za-z0-9_-]{1,31}")) throw new IllegalArgumentException("Use the configured board address and provider.");
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Bluetooth is unavailable or off. No device operation ran.");
        final long expected = ++generation; result = callback;
        main.postDelayed(() -> finish(expected, null, "The original BLE manifest read timed out. No automatic retry ran."), 12000);
        try {
            connection = adapter.getRemoteDevice(address).connectGatt(context, false, new BluetoothGattCallback() {
                @Override public void onConnectionStateChange(BluetoothGatt gatt, int status, int state) {
                    main.post(() -> {
                        if (generation != expected) { gatt.close(); return; }
                        if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) { finish(expected, null, "The configured Bluetooth board did not connect."); return; }
                        if (state == BluetoothProfile.STATE_CONNECTED && !gatt.discoverServices()) finish(expected, null, "BLE service discovery did not start.");
                    });
                }
                @Override public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    main.post(() -> {
                        if (generation != expected) return;
                        BluetoothGattService service = gatt.getService(SERVICE);
                        BluetoothGattCharacteristic characteristic = service == null ? null : service.getCharacteristic(MANIFEST);
                        if (status != BluetoothGatt.GATT_SUCCESS || characteristic == null || !gatt.readCharacteristic(characteristic)) finish(expected, null, "The board lacks the required manifest read service.");
                    });
                }
                private void received(BluetoothGattCharacteristic characteristic, byte[] bytes, int status) {
                    main.post(() -> {
                        if (generation != expected || !MANIFEST.equals(characteristic.getUuid())) return;
                        try {
                            if (status != BluetoothGatt.GATT_SUCCESS || bytes == null || bytes.length > 8192) throw new IllegalArgumentException();
                            JSONObject manifest = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                            if (!"capmesh/0.1".equals(manifest.optString("protocol")) || !provider.equals(manifest.optString("device_id"))) throw new IllegalArgumentException();
                            finish(expected, manifest, null);
                        } catch (Exception error) { finish(expected, null, "The configured board returned a different or invalid manifest."); }
                    });
                }
                @Override public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) { if (android.os.Build.VERSION.SDK_INT < 33) received(characteristic, characteristic.getValue(), status); }
                @Override public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value, int status) { received(characteristic, value.clone(), status); }
            }, BluetoothDevice.TRANSPORT_LE);
            if (connection == null) finish(expected, null, "The configured Bluetooth connection did not start.");
        } catch (SecurityException error) { finish(expected, null, "Nearby-device permission is required for the configured manifest read."); }
    }
}
