package com.crednivo.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "CrednivoAppLock")
public class CrednivoAppLockPlugin extends Plugin {
    private static final String PREFS = "crednivo_secure_app_lock";
    private static final String KEY_ALIAS = "crednivo_app_lock_aes_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            boolean hasFingerprintHardware = getContext().getPackageManager()
                    .hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);

            int result = BiometricManager.from(getContext()).canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                            | BiometricManager.Authenticators.BIOMETRIC_WEAK
            );

            JSObject response = new JSObject();
            response.put("isAvailable", hasFingerprintHardware && result == BiometricManager.BIOMETRIC_SUCCESS);
            response.put("status", result);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Unable to check fingerprint availability", "BIOMETRIC_CHECK_FAILED", error);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) {
            call.reject("Activity is unavailable", "NO_ACTIVITY");
            return;
        }

        String title = valueOr(call.getString("title"), "CREDNIVO");
        String subtitle = valueOr(call.getString("subtitle"), "Welcome back");
        String description = valueOr(call.getString("description"), "Use your fingerprint to unlock the app.");
        String negativeButton = valueOr(call.getString("negativeButtonText"), "Use PIN");

        activity.runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(
                    activity,
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            JSObject response = new JSObject();
                            response.put("authenticated", true);
                            call.resolve(response);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                                call.reject("Use PIN", "USE_PIN");
                            } else if (errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                    || errorCode == BiometricPrompt.ERROR_CANCELED) {
                                call.reject("Fingerprint cancelled", "CANCELLED");
                            } else if (errorCode == BiometricPrompt.ERROR_LOCKOUT
                                    || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT) {
                                call.reject("Fingerprint is temporarily unavailable", "LOCKED_OUT");
                            } else {
                                call.reject(errString.toString(), "BIOMETRIC_ERROR_" + errorCode);
                            }
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            // Keep the Android biometric prompt open so the user can retry.
                        }
                    }
            );

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setDescription(description)
                    .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG
                                    | BiometricManager.Authenticators.BIOMETRIC_WEAK
                    )
                    .setNegativeButtonText(negativeButton)
                    .build();

            prompt.authenticate(info);
        });
    }

    @PluginMethod
    public void saveRecord(PluginCall call) {
        String accountKey = call.getString("accountKey");
        String value = call.getString("value");
        if (accountKey == null || accountKey.isBlank() || value == null) {
            call.reject("accountKey and value are required", "INVALID_ARGUMENT");
            return;
        }

        try {
            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();

            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString(accountKey + ".iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                    .putString(accountKey + ".data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .apply();

            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to securely save the App PIN", "SECURE_SAVE_FAILED", error);
        }
    }

    @PluginMethod
    public void getRecord(PluginCall call) {
        String accountKey = call.getString("accountKey");
        if (accountKey == null || accountKey.isBlank()) {
            call.reject("accountKey is required", "INVALID_ARGUMENT");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String ivText = prefs.getString(accountKey + ".iv", null);
            String dataText = prefs.getString(accountKey + ".data", null);

            JSObject response = new JSObject();
            if (ivText == null || dataText == null) {
                response.put("value", JSObject.NULL);
                call.resolve(response);
                return;
            }

            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            byte[] iv = Base64.decode(ivText, Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(dataText, Base64.NO_WRAP);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] decrypted = cipher.doFinal(encrypted);

            response.put("value", new String(decrypted, StandardCharsets.UTF_8));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Unable to read the secure App PIN", "SECURE_READ_FAILED", error);
        }
    }

    @PluginMethod
    public void deleteRecord(PluginCall call) {
        String accountKey = call.getString("accountKey");
        if (accountKey == null || accountKey.isBlank()) {
            call.reject("accountKey is required", "INVALID_ARGUMENT");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(accountKey + ".iv")
                .remove(accountKey + ".data")
                .apply();
        call.resolve();
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
