package com.proofofready.seeker;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

/** Explicit local instrumentation exercises real Android SQLite. It never uses camera or BLE. */
public final class CompanionInstrumentation extends Instrumentation {
    private int assertions;
    private void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
    private JSONObject challenge(String id) throws Exception { return new JSONObject("{\"schema\":\"proof-of-ready/phone-challenge/v1\",\"work_order_digest\":\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"session_id\":\"0123456789abcdef\",\"request_id\":\"" + id + "\",\"provider\":\"seeker-inspector\",\"nonce\":1,\"requested_at\":1000,\"expires_at\":1060}"); }
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle report = new Bundle(); Context context = getTargetContext(); String name = "instrumentation-requests-" + System.nanoTime() + ".sqlite";
        RequestLedger first = null, second = null;
        try {
            JSONObject request = Protocol.challenge(challenge("aaaaaaaaaaaaaaaa").toString(),1000);
            first = new RequestLedger(context,name); first.reserve(request); check("RESERVED".equals(first.state("aaaaaaaaaaaaaaaa")),"Reservation missing.");
            first.close(); first = new RequestLedger(context,name);
            try { first.reserve(request); throw new AssertionError("Restart reused the original request."); } catch (IllegalStateException expected) { assertions++; }
            first.transition("aaaaaaaaaaaaaaaa","RESERVED","CAPTURING",null);
            try { first.transition("aaaaaaaaaaaaaaaa","RESERVED","CAPTURING",null); throw new AssertionError("Duplicate capture transition accepted."); } catch (IllegalStateException expected) { assertions++; }
            JSONObject saved = new JSONObject().put("fixture",true); first.transition("aaaaaaaaaaaaaaaa","CAPTURING","COMPLETE",saved); first.close(); first = new RequestLedger(context,name);
            check(first.completed("aaaaaaaaaaaaaaaa").getBoolean("fixture"),"Completed bytes changed on reopen.");
            second = new RequestLedger(context,name); final RequestLedger a = first, b = second; final JSONObject concurrent = challenge("bbbbbbbbbbbbbbbb"); CountDownLatch start = new CountDownLatch(1), done = new CountDownLatch(2); AtomicInteger accepted = new AtomicInteger(), rejected = new AtomicInteger();
            for (RequestLedger ledger : new RequestLedger[]{a,b}) new Thread(() -> { try { start.await(); ledger.reserve(concurrent); accepted.incrementAndGet(); } catch (Exception expected) { rejected.incrementAndGet(); } finally { done.countDown(); } }).start();
            start.countDown(); check(done.await(10,java.util.concurrent.TimeUnit.SECONDS),"Concurrent writers did not finish."); check(accepted.get() == 1 && rejected.get() == 1,"Concurrent writers both reserved a request.");
            for (long now : new long[]{999,1000,1060}) Protocol.challenge(request.toString(),now);
            for (long now : new long[]{997,1061}) try { Protocol.challenge(request.toString(),now); throw new AssertionError("Invalid clock accepted."); } catch (IllegalArgumentException expected) { assertions++; }
            JSONObject numeric = challenge("1111111111111111").put("session_id",1111111111111111L);
            try { Protocol.challenge(numeric.toString(),1000); throw new AssertionError("Numeric text field accepted."); } catch (IllegalArgumentException expected) { assertions++; }
            JSONObject envelope = new JSONObject(request.toString()).put("image_sha256","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").put("captured_at",1001).put("key_security_level","software_reported");
            check(Protocol.message(envelope).equals("proof-of-ready-phone-photo-v1|0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|0123456789abcdef|aaaaaaaaaaaaaaaa|seeker-inspector|1|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|1000|1060|1001|software_reported"),"Java phone wire message changed.");
            report.putString("stream","Android SQLite restart/concurrency and challenge/wire tests passed. Assertions: " + assertions); report.putInt("assertions",assertions); finish(Activity.RESULT_OK,report);
        } catch (Throwable error) { report.putString("stream","Companion verification failed: " + error.getClass().getSimpleName() + ": " + error.getMessage()); finish(Activity.RESULT_CANCELED,report); }
        finally { if (second != null) second.close(); if (first != null) first.close(); context.deleteDatabase(name); }
    }
}
