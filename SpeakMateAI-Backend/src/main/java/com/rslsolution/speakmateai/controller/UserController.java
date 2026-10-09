package com.rslsolution.speakmateai.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rslsolution.speakmateai.dto.request.DeleteAccountRequest;
import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.LoginRequest;
import com.rslsolution.speakmateai.dto.request.RegisterRequest;
import com.rslsolution.speakmateai.dto.request.ResetPasswordRequest;
import com.rslsolution.speakmateai.dto.request.CompleteOnboardingRequest;
import com.rslsolution.speakmateai.dto.request.SendDeleteAccountOtpRequest;
import com.rslsolution.speakmateai.dto.request.SendRegistrationOtpRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.dto.response.AuthResponse;
import com.rslsolution.speakmateai.dto.response.UserResponse;
import com.rslsolution.speakmateai.dto.response.VerifyOtpResponse;
import com.rslsolution.speakmateai.service.UserService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.util.HtmlUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

	private static final Pattern VALID_TOKEN_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{16,128}$");
	private static final Pattern VALID_EXPO_URL_PATTERN = Pattern.compile("^(exp://|https?://)[a-zA-Z0-9.:/_~%+-]{3,150}$");

	private static boolean isValidExpoUrl(String url) {
		if (url == null || url.isBlank() || url.length() > 150) {
			return false;
		}
		if (url.contains("<") || url.contains(">") || url.contains("\"") || url.contains("'")
				|| url.contains(";") || url.contains("\n") || url.contains("\r")
				|| url.contains("`") || url.contains("\\") || url.contains(" ")) {
			return false;
		}
		return VALID_EXPO_URL_PATTERN.matcher(url).matches();
	}

	private void attachAuthCookie(HttpServletResponse response, HttpServletRequest request, String jwtToken) {
		if (response == null || jwtToken == null || jwtToken.isBlank()) {
			return;
		}
		boolean isSecure = request != null && (request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")));
		ResponseCookie cookie = ResponseCookie.from("speakmate_token", jwtToken)
				.httpOnly(true)
				.secure(isSecure)
				.path("/")
				.maxAge(Duration.ofHours(24))
				.sameSite(isSecure ? "None" : "Lax")
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	private void clearAuthCookie(HttpServletResponse response, HttpServletRequest request) {
		if (response == null) {
			return;
		}
		boolean isSecure = request != null && (request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")));
		ResponseCookie cookie = ResponseCookie.from("speakmate_token", "")
				.httpOnly(true)
				.secure(isSecure)
				.path("/")
				.maxAge(Duration.ZERO)
				.sameSite(isSecure ? "None" : "Lax")
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	@Autowired
	private UserService userService;

	@PostMapping("/send-registration-otp")
	public String sendRegistrationOtp(@Valid @RequestBody SendRegistrationOtpRequest request) {
		userService.sendRegistrationOtp(request);
		return "Registration OTP has been sent to your email address.";
	}

	@PostMapping("/verify-registration-otp")
	public VerifyOtpResponse verifyRegistrationOtp(@Valid @RequestBody VerifyOtpRequest request) {
		return userService.verifyRegistrationOtp(request);
	}

	@PostMapping("/send-delete-account-otp")
	public String sendDeleteAccountOtp(@Valid @RequestBody SendDeleteAccountOtpRequest request) {
		userService.sendDeleteAccountOtp(request);
		return "Account deletion OTP verification code has been sent to your email address.";
	}

	@PostMapping("/verify-delete-account-otp")
	public VerifyOtpResponse verifyDeleteAccountOtp(@Valid @RequestBody VerifyOtpRequest request) {
		return userService.verifyDeleteAccountOtp(request);
	}

	@PostMapping("/delete-account")
	public String deleteAccount(@Valid @RequestBody DeleteAccountRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
		userService.deleteAccountWithOtp(request);
		clearAuthCookie(httpResponse, httpRequest);
		return "Account deleted successfully.";
	}

	@PostMapping("/register")
	public UserResponse register(@Valid @RequestBody RegisterRequest request) {
		return userService.register(request);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
		AuthResponse authResponse = userService.login(request);
		if (authResponse != null && authResponse.getToken() != null) {
			attachAuthCookie(httpResponse, httpRequest, authResponse.getToken());
		}
		return authResponse;
	}

	@PostMapping("/logout")
	public ResponseEntity<?> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
		clearAuthCookie(httpResponse, httpRequest);
		return ResponseEntity.ok(java.util.Map.of("message", "Logged out successfully"));
	}

	@PostMapping("/forgot-password")
	public String forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
		userService.forgotPassword(request);
		return "An OTP code has been sent to your email address.";
	}

	@PostMapping("/verify-otp")
	public VerifyOtpResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
		return userService.verifyOtp(request);
	}

	@PostMapping("/reset-password")
	public String resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
		userService.resetPassword(request);
		return "Password reset successfully.";
	}

	private static String lastRegisteredExpoUrl = null;

	@PostMapping("/register-expo-url")
	public ResponseEntity<?> registerExpoUrl(@RequestBody java.util.Map<String, String> payload) {
		String url = payload != null ? payload.get("url") : null;
		if (url != null) {
			url = url.trim();
			if (!isValidExpoUrl(url)) {
				return ResponseEntity.badRequest().body(java.util.Map.of("message", "Invalid Expo URL format. Allowed schemes: exp://, http://, https://"));
			}
			if (url.endsWith("/")) {
				url = url.substring(0, url.length() - 1);
			}
			if (url.endsWith("/--")) {
				url = url.substring(0, url.length() - 3);
			}
			lastRegisteredExpoUrl = url;
			System.out.println("[Expo URL Registered] Active developer Expo URL: " + lastRegisteredExpoUrl);
			return ResponseEntity.ok(java.util.Map.of("message", "Expo URL registered successfully"));
		}
		return ResponseEntity.badRequest().body(java.util.Map.of("message", "URL is required"));
	}

	@GetMapping(value = "/reset-redirect", produces = MediaType.TEXT_HTML_VALUE)
	public ResponseEntity<String> resetRedirect(
			@org.springframework.web.bind.annotation.RequestParam(required = false) String token,
			HttpServletRequest request) {

		// 1. Strict input validation on reset token (alphanumeric/UUID only)
		if (token == null || !VALID_TOKEN_PATTERN.matcher(token).matches()) {
			String safeErrorHtml = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">" +
					"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
					"<title>SpeakMateAI - Invalid Reset Link</title>" +
					"<style>" +
					"body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F172A; color: #FFFFFF; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }" +
					".card { background-color: #1E293B; border-radius: 24px; padding: 32px; border: 1px solid #334155; max-width: 440px; width: 100%; box-sizing: border-box; }" +
					".logo { font-size: 26px; font-weight: 900; color: #6366F1; margin-bottom: 16px; }" +
					"h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #F43F5E; }" +
					"p { font-size: 14px; color: #94A3B8; line-height: 22px; margin-bottom: 0; }" +
					"</style></head><body>" +
					"<div class=\"card\">" +
					"<div class=\"logo\">SpeakMateAI</div>" +
					"<h1>Invalid or Expired Link</h1>" +
					"<p>The password reset token is missing, malformed, or expired. Please return to the app or website to request a new password reset code.</p>" +
					"</div></body></html>";

			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';")
					.header("X-Content-Type-Options", "nosniff")
					.header("X-Frame-Options", "DENY")
					.header("Referrer-Policy", "no-referrer")
					.header("Cache-Control", "no-store, no-cache, must-revalidate")
					.body(safeErrorHtml);
		}

		// 2. Validate host and construct safe default Expo URL
		String host = request.getHeader("Host");
		String ipAddress = "localhost";
		if (host != null && host.matches("^[a-zA-Z0-9.:-]+$")) {
			if (host.endsWith("/")) {
				host = host.substring(0, host.length() - 1);
			}
			ipAddress = host.contains(":") ? host.split(":")[0] : host;
		}

		String expoUrlToUse = lastRegisteredExpoUrl;
		if (expoUrlToUse == null || !isValidExpoUrl(expoUrlToUse)) {
			expoUrlToUse = "exp://" + ipAddress + ":8081";
		}

		// 3. Strict HTML-escaping of all dynamic values before rendering
		String safeToken = HtmlUtils.htmlEscape(token);
		String safeExpoUrl = HtmlUtils.htmlEscape(expoUrlToUse);

		// 4. Safe HTML template: Data is placed in data-* attributes rather than inline script interpolation
		String html = String.format(
			"<!DOCTYPE html>\n" +
			"<html lang=\"en\">\n" +
			"<head>\n" +
			"    <meta charset=\"UTF-8\">\n" +
			"    <title>Opening SpeakMateAI...</title>\n" +
			"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
			"    <style>\n" +
			"        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; color: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }\n" +
			"        .card { background-color: #1E293B; border-radius: 24px; padding: 32px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); border: 1px solid #334155; max-width: 440px; width: 100%%; box-sizing: border-box; }\n" +
			"        .logo { font-size: 28px; font-weight: 900; color: #6366F1; margin-bottom: 20px; letter-spacing: -0.5px; }\n" +
			"        h1 { font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #F8FAFC; }\n" +
			"        p { font-size: 14px; color: #94A3B8; margin-bottom: 24px; line-height: 22px; }\n" +
			"        .btn { display: block; background-color: #6366F1; color: #FFFFFF !important; padding: 14px; border-radius: 12px; text-decoration: none; font-size: 15px; font-weight: bold; margin-bottom: 12px; transition: background-color 0.2s; }\n" +
			"        .btn:hover { background-color: #4F46E5; }\n" +
			"        .btn-expo { background-color: #3B82F6; }\n" +
			"        .btn-expo:hover { background-color: #2563EB; }\n" +
			"        .footer { font-size: 12px; color: #64748B; margin-top: 18px; line-height: 18px; }\n" +
			"    </style>\n" +
			"</head>\n" +
			"<body>\n" +
			"    <div class=\"card\" id=\"reset-container\" data-token=\"%s\" data-expo-url=\"%s\">\n" +
			"        <div class=\"logo\">SpeakMateAI</div>\n" +
			"        <h1>Reset Password</h1>\n" +
			"        <p>Choose an option below to open the password reset page in your app.</p>\n" +
			"        \n" +
			"        <a id=\"btn-expo\" href=\"%s/--/auth/reset-password?token=%s\" class=\"btn btn-expo\">Open in Expo Go</a>\n" +
			"        <a id=\"btn-app\" href=\"speakmateai://auth/reset-password?token=%s\" class=\"btn\">Open in App (Standalone)</a>\n" +
			"        \n" +
			"        <div style=\"margin-top: 20px; border-top: 1px solid #334155; padding-top: 20px; text-align: left;\">\n" +
			"            <label style=\"font-size: 12px; color: #94A3B8; font-weight: bold; display: block; margin-bottom: 8px;\">Testing with Expo Tunnel?</label>\n" +
			"            <div style=\"display: flex; gap: 8px;\">\n" +
			"                <input id=\"tunnel-input\" type=\"text\" placeholder=\"exp://xxxx.exp.direct\" style=\"flex: 1; background-color: #0F172A; border: 1px solid #475569; border-radius: 8px; color: #FFFFFF; padding: 8px 12px; font-size: 13px;\" />\n" +
			"                <button id=\"tunnel-btn\" style=\"background-color: #3B82F6; color: #FFFFFF; border: none; border-radius: 8px; padding: 8px 14px; font-weight: bold; cursor: pointer; font-size: 13px;\">Open</button>\n" +
			"            </div>\n" +
			"        </div>\n" +
			"        \n" +
			"        <div class=\"footer\">If the app doesn't open automatically, please select an option above.</div>\n" +
			"    </div>\n" +
			"    \n" +
			"    <script>\n" +
			"        (function() {\n" +
			"            var container = document.getElementById('reset-container');\n" +
			"            if (!container) return;\n" +
			"            var token = container.getAttribute('data-token') || '';\n" +
			"            var activeExpoUrl = container.getAttribute('data-expo-url') || '';\n" +
			"            \n" +
			"            if (activeExpoUrl) {\n" +
			"                setTimeout(function() { \n" +
			"                    window.location.href = activeExpoUrl + '/--/auth/reset-password?token=' + encodeURIComponent(token);\n" +
			"                }, 300);\n" +
			"            }\n" +
			"            setTimeout(function() { \n" +
			"                window.location.href = 'speakmateai://auth/reset-password?token=' + encodeURIComponent(token); \n" +
			"            }, 1500);\n" +
			"\n" +
			"            var tunnelBtn = document.getElementById('tunnel-btn');\n" +
			"            if (tunnelBtn) {\n" +
			"                tunnelBtn.addEventListener('click', function() {\n" +
			"                    var inputEl = document.getElementById('tunnel-input');\n" +
			"                    var base = inputEl ? inputEl.value.trim() : '';\n" +
			"                    if (!base || !base.startsWith('exp://')) {\n" +
			"                        alert('Please enter a valid Expo URL (starts with exp://)');\n" +
			"                        return;\n" +
			"                    }\n" +
			"                    base = base.replace(/\\/+$/, '');\n" +
			"                    if (base.indexOf('/--') !== -1) {\n" +
			"                        base = base.split('/--')[0];\n" +
			"                    }\n" +
			"                    window.location.href = base + '/--/auth/reset-password?token=' + encodeURIComponent(token);\n" +
			"                });\n" +
			"            }\n" +
			"        })();\n" +
			"    </script>\n" +
			"</body>\n" +
			"</html>",
			safeToken, safeExpoUrl, safeExpoUrl, safeToken, safeToken
		);

		return ResponseEntity.ok()
				.header("Content-Security-Policy",
						"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'self';")
				.header("X-Content-Type-Options", "nosniff")
				.header("X-Frame-Options", "DENY")
				.header("Referrer-Policy", "no-referrer")
				.header("Cache-Control", "no-store, no-cache, must-revalidate")
				.body(html);
	}

	@GetMapping("/me")
	public UserResponse me() {
		return userService.getCurrentUser();
	}

	@PostMapping("/complete-onboarding")
	public UserResponse completeOnboarding(@RequestBody CompleteOnboardingRequest request) {
		return userService.completeOnboarding(request);
	}

	@GetMapping("/get-all-users")
	@PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')")
	public List<UserResponse> getAllUsers() {
		return userService.getAllUsers();
	}

	@GetMapping("/get-user-by-id/{id}")
	public UserResponse getUserById(@PathVariable Long id) {
		return userService.getUserById(id);
	}

	@PutMapping("/update-user/{id}")
	public UserResponse updateUser(@PathVariable Long id, @Valid @RequestBody RegisterRequest request) {
		return userService.updateUser(id, request);
	}

	@DeleteMapping("/delete-user/{id}")
	@PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')")
	public String deleteUser(@PathVariable Long id) {
		userService.deleteUser(id);
		return "User deleted successfully.";
	}
}
