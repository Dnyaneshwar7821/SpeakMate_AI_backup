package com.rslsolution.speakmateai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.security.access.prepost.PreAuthorize;
import com.rslsolution.speakmateai.dto.request.AdminChangePasswordRequest;
import com.rslsolution.speakmateai.dto.request.AdminLoginRequest;
import com.rslsolution.speakmateai.dto.request.AdminRefreshTokenRequest;
import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.ResetPasswordRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.dto.response.AdminLoginResponse;
import com.rslsolution.speakmateai.dto.response.ApiResponse;
import com.rslsolution.speakmateai.dto.response.VerifyOtpResponse;
import com.rslsolution.speakmateai.service.AdminAuthService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth/admin")
@CrossOrigin(origins = "*")
public class AdminAuthController {

	private final AdminAuthService adminAuthService;

	public AdminAuthController(AdminAuthService adminAuthService) {
		this.adminAuthService = adminAuthService;
	}

	@PostMapping("/register")
	@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
	public ResponseEntity<ApiResponse<String>> register(@Valid @RequestBody com.rslsolution.speakmateai.dto.request.AdminRegisterRequest request) {
		adminAuthService.register(request);
		return ResponseEntity.ok(ApiResponse.success("Admin registered successfully"));
	}

	@PostMapping("/login")
	public ResponseEntity<ApiResponse<AdminLoginResponse>> login(@Valid @RequestBody AdminLoginRequest request) {
		AdminLoginResponse loginResponse = adminAuthService.login(request);
		return ResponseEntity.ok(ApiResponse.success("Login Successful", loginResponse));
	}

	@PostMapping("/logout")
	public ResponseEntity<ApiResponse<String>> logout() {
		adminAuthService.logout();
		return ResponseEntity.ok(ApiResponse.success("Logout Successful"));
	}

	@PutMapping("/change-password")
	public ResponseEntity<ApiResponse<String>> changePassword(@Valid @RequestBody AdminChangePasswordRequest request) {
		adminAuthService.changePassword(request);
		return ResponseEntity.ok(ApiResponse.success("Password changed successfully"));
	}

	@PostMapping("/forgot-password")
	public ResponseEntity<ApiResponse<String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
		adminAuthService.forgotPassword(request);
		return ResponseEntity.ok(ApiResponse.success("Forgot password flow initiated successfully"));
	}

	@PostMapping("/verify-otp")
	public ResponseEntity<ApiResponse<VerifyOtpResponse>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
		VerifyOtpResponse response = adminAuthService.verifyOtp(request);
		return ResponseEntity.ok(ApiResponse.success("OTP Verified", response));
	}

	@PostMapping("/reset-password")
	public ResponseEntity<ApiResponse<String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
		adminAuthService.resetPassword(request);
		return ResponseEntity.ok(ApiResponse.success("Password reset successfully"));
	}

	@PostMapping("/refresh-token")
	public ResponseEntity<ApiResponse<AdminLoginResponse>> refreshToken(@Valid @RequestBody AdminRefreshTokenRequest request) {
		AdminLoginResponse loginResponse = adminAuthService.refreshToken(request);
		return ResponseEntity.ok(ApiResponse.success("Token refreshed successfully", loginResponse));
	}
}
