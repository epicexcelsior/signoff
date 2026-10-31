package com.proofofready.seeker;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;

/** A request is reserved before camera dispatch and never becomes reusable. */
public final class RequestLedger extends SQLiteOpenHelper {
    public RequestLedger(Context context) { this(context, "requests.sqlite"); }
    RequestLedger(Context context, String name) { super(context, name, null, 1); setWriteAheadLoggingEnabled(true); }
    @Override public void onConfigure(SQLiteDatabase db) { db.execSQL("PRAGMA synchronous=FULL"); }
    @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE requests (id TEXT PRIMARY KEY,challenge TEXT NOT NULL,state TEXT NOT NULL,envelope TEXT)"); }
    @Override public void onUpgrade(SQLiteDatabase db, int before, int after) { throw new IllegalStateException("A ledger migration is required."); }
    public synchronized void reserve(JSONObject challenge) throws Exception {
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            try (Cursor count = db.rawQuery("SELECT count(*) FROM requests", null)) { count.moveToFirst(); if (count.getInt(0) >= 500) throw new IllegalStateException("The phone ledger reached its 500-request limit."); }
            ContentValues values = new ContentValues(); values.put("id", challenge.getString("request_id")); values.put("challenge", challenge.toString()); values.put("state", "RESERVED");
            if (db.insertWithOnConflict("requests", null, values, SQLiteDatabase.CONFLICT_IGNORE) < 0) throw new IllegalStateException("This capture request already ran or remains interrupted. Start a new coordinator attempt.");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    public synchronized void transition(String id, String before, String after, JSONObject envelope) {
        ContentValues values = new ContentValues(); values.put("state", after);
        if (envelope != null) values.put("envelope", envelope.toString());
        if (getWritableDatabase().update("requests", values, "id=? AND state=?", new String[]{id, before}) != 1) throw new IllegalStateException("The original capture state changed. Do not repeat it.");
    }
    public synchronized JSONObject completed(String id) throws Exception {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT envelope FROM requests WHERE id=? AND state='COMPLETE'", new String[]{id})) {
            if (!cursor.moveToFirst()) throw new IllegalStateException("This request has no completed signed photo.");
            return new JSONObject(cursor.getString(0));
        }
    }
    public synchronized String latestId() {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT id FROM requests WHERE state='COMPLETE' ORDER BY rowid DESC LIMIT 1", null)) { return cursor.moveToFirst() ? cursor.getString(0) : null; }
    }
    public synchronized String state(String id) {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT state FROM requests WHERE id=?", new String[]{id})) { return cursor.moveToFirst() ? cursor.getString(0) : null; }
    }
}
