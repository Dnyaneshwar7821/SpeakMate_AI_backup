package com.rslsolution.speakmateai.service.impl;

import java.security.SecureRandom;
import java.time.LocalDateTime;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.AdminChangePasswordRequest;
import com.rslsolution.speakmateai.dto.request.AdminLoginRequest;
import com.rslsolution.speakmateai.dto.request.AdminRefreshTokenRequest;
import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.ResetPasswordRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.dto.response.AdminLoginResponse;
import com.rslsolution.speakmateai.dto.response.VerifyOtpResponse;

import org.springframework.beans.factory.annotation.Autowired;
import com.rslsolution.speakmateai.service.EmailService;
import com.rslsolution.speakmateai.service.email.EmailMessage;
import java.util.UUID;
import com.rslsolution.speakmateai.entity.Admin;
import com.rslsolution.speakmateai.enums.AdminStatus;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.exception.InvalidCredentialsException;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.service.AdminAuthService;
import com.rslsolution.speakmateai.util.JwtUtil;

@Service
@Transactional
public class AdminAuthServiceImpl implements AdminAuthService {

	private final AdminRepository adminRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtUtil jwtUtil;
	private final EmailService emailService;

	public AdminAuthServiceImpl(AdminRepository adminRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
			EmailService emailService) {
		this.adminRepository = adminRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtUtil = jwtUtil;
		this.emailService = emailService;
	}

	@Override
	public void register(com.rslsolution.speakmateai.dto.request.AdminRegisterRequest request) {
		if (adminRepository.findByEmail(request.getEmail()).isPresent()) {
			throw new IllegalArgumentException("Admin with this email already exists");
		}

		Role targetRole = request.getRole() != null ? request.getRole() : Role.ADMIN;
		if (targetRole != Role.ADMIN && targetRole != Role.SUPER_ADMIN) {
			targetRole = Role.ADMIN;
		}

		Admin admin = Admin.builder()
				.fullName(request.getFullName())
				.email(request.getEmail())
				.password(passwordEncoder.encode(request.getPassword()))
				.phone(com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getPhone(),
						"Phone number"))
				.role(targetRole)
				.status(AdminStatus.ACTIVE)
				.resetOtpAttempts(0)
				.build();

		adminRepository.save(admin);
	}

	@Override
	public AdminLoginResponse login(AdminLoginRequest request) {
		String email = request.getEmail() != null ? request.getEmail().trim() : "";
		Admin admin = adminRepository.findByEmail(email)
				.or(() -> adminRepository.findByEmail(request.getEmail()))
				.orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

		if (!passwordEncoder.matches(request.getPassword(), admin.getPassword())) {
			throw new InvalidCredentialsException("Invalid email or password");
		}

		// Super Admin can never be restricted or deactivated
		if (admin.getRole() == Role.SUPER_ADMIN) {
			if (admin.getStatus() != AdminStatus.ACTIVE) {
				admin.setStatus(AdminStatus.ACTIVE);
				adminRepository.save(admin);
			}
		} else if (admin.getStatus() != AdminStatus.ACTIVE) {
			throw new InvalidCredentialsException("Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.");
		}

		admin.setLastLogin(LocalDateTime.now());
		adminRepository.save(admin);

		String token = jwtUtil.generateAdminToken(admin.getEmail(), admin.getRole().name(), admin.getId());

		return AdminLoginResponse.builder()
				.adminId(admin.getId())
				.fullName(admin.getFullName())
				.email(admin.getEmail())
				.role(admin.getRole())
				.profileImage(admin.getProfileImage())
				.jwtToken(token)
				.build();
	}

	@Override
	public void logout() {
		SecurityContextHolder.clearContext();
	}

	@Override
	public void changePassword(AdminChangePasswordRequest request) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()
				|| "anonymousUser".equals(authentication.getName())) {
			throw new InvalidCredentialsException("Admin not authenticated");
		}

		String email = authentication.getName();
		Admin admin = adminRepository.findByEmail(email)
				.orElseThrow(() -> new InvalidCredentialsException("Admin account not found"));

		if (!passwordEncoder.matches(request.getOldPassword(), admin.getPassword())) {
			throw new InvalidCredentialsException("Invalid old password");
		}

		String newPassword = request.getNewPassword();
		validatePasswordStrength(newPassword);

		admin.setPassword(passwordEncoder.encode(newPassword));
		adminRepository.save(admin);
	}

	@Override
	public void forgotPassword(ForgotPasswordRequest request) {
		String cleanEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";

		Admin admin = adminRepository.findByEmail(cleanEmail)
				.orElseThrow(() -> new IllegalArgumentException(
						"No registered admin account found with email: " + cleanEmail));

		SecureRandom secureRandom = new SecureRandom();
		String otp = String.format("%06d", secureRandom.nextInt(1000000));
		admin.setResetOtp(otp);
		admin.setResetOtpExpiry(LocalDateTime.now().plusMinutes(10));
		admin.setResetOtpAttempts(0);
		adminRepository.save(admin);

		String htmlContent = String.format(
				"<!DOCTYPE html>\n" +
						"<html>\n" +
						"<head>\n" +
						"    <style>\n" +
						"        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; }\n"
						+
						"        .container { max-width: 600px; background-color: #FFFFFF; border-radius: 16px; padding: 40px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }\n"
						+
						"        .logo { font-size: 28px; font-weight: 900; color: #4F46E5; text-align: center; margin-bottom: 24px; }\n"
						+
						"        h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px; text-align: center; }\n"
						+
						"        p { font-size: 15px; color: #64748B; line-height: 24px; margin-bottom: 24px; }\n" +
						"        .otp-box { background-color: #EEF2FF; border: 2px dashed #6366F1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }\n"
						+
						"        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #4F46E5; margin: 0; }\n"
						+
						"        .footer { text-align: center; font-size: 13px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px; }\n"
						+
						"    </style>\n" +
						"</head>\n" +
						"<body>\n" +
						"    <div class=\"container\">\n" +
						"        <div class=\"logo\">SpeakMateAI Admin Portal</div>\n" +
						"        <h1>Password Reset OTP</h1>\n" +
						"        <p>Hello %s,</p>\n" +
						"        <p>We received a request to reset your admin password. Use the Verification Code below to complete your reset request:</p>\n"
						+
						"        <div class=\"otp-box\">\n" +
						"            <h2 class=\"otp-code\">%s</h2>\n" +
						"        </div>\n" +
						"        <p>This OTP code is valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>\n"
						+
						"        <p>If you did not request a password reset, please ignore this message.</p>\n" +
						"        <div class=\"footer\">\n" +
						"            Regards,<br/><strong>SpeakMateAI Team</strong>\n" +
						"        </div>\n" +
						"    </div>\n" +
						"</body>\n" +
						"</html>",
				admin.getFullName(), otp);
		EmailMessage emailMessage = EmailMessage.builder()
				.to(admin.getEmail())
				.subject("Your SpeakMateAI Admin Password Reset OTP")
				.htmlContent(htmlContent)
				.text(htmlContent)
				.html(true)
				.senderName("SpeakMateAI Admin")
				.build();
		emailService.sendAsyncEmail(emailMessage);
	}

	@Override
	public VerifyOtpResponse verifyOtp(VerifyOtpRequest request) {
		Admin admin = adminRepository.findByEmail(request.getEmail())
				.orElseThrow(() -> new IllegalArgumentException("Invalid email or admin not found."));

		int attempts = admin.getResetOtpAttempts() != null ? admin.getResetOtpAttempts() : 0;
		if (attempts >= 5) {
			admin.setResetOtp(null);
			admin.setResetOtpExpiry(null);
			adminRepository.save(admin);
			throw new IllegalArgumentException("Too many failed attempts. This OTP has been invalidated, please request a new one.");
		}

		if (admin.getResetOtpExpiry() == null || admin.getResetOtpExpiry().isBefore(LocalDateTime.now())) {
			throw new IllegalArgumentException("OTP code has expired. Please request a new OTP.");
		}

		String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";
		if (admin.getResetOtp() == null || !admin.getResetOtp().equals(inputOtp)) {
			int updatedAttempts = attempts + 1;
			admin.setResetOtpAttempts(updatedAttempts);
			if (updatedAttempts >= 5) {
				admin.setResetOtp(null);
				admin.setResetOtpExpiry(null);
				adminRepository.save(admin);
				throw new IllegalArgumentException("Too many failed attempts. This OTP has been invalidated, please request a new one.");
			}
			adminRepository.save(admin);
			int remaining = 5 - updatedAttempts;
			throw new IllegalArgumentException("Invalid OTP code. " + remaining + " attempts remaining.");
		}

		String token = UUID.randomUUID().toString();
		admin.setResetPasswordToken(token);
		admin.setResetPasswordTokenExpiry(LocalDateTime.now().plusMinutes(15));
		admin.setResetOtp(null);
		admin.setResetOtpExpiry(null);
		admin.setResetOtpAttempts(0);
		adminRepository.save(admin);

		return VerifyOtpResponse.builder()
				.token(token)
				.message("OTP verified successfully.")
				.build();
	}

	@Override
	public void resetPassword(ResetPasswordRequest request) {
		Admin admin = adminRepository.findByResetPasswordToken(request.getToken())
				.orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token."));

		if (admin.getResetPasswordTokenExpiry() == null
				|| admin.getResetPasswordTokenExpiry().isBefore(LocalDateTime.now())) {
			throw new IllegalArgumentException("Reset token has expired.");
		}

		validatePasswordStrength(request.getNewPassword());

		admin.setPassword(passwordEncoder.encode(request.getNewPassword()));
		admin.setResetPasswordToken(null);
		admin.setResetPasswordTokenExpiry(null);
		admin.setResetOtpAttempts(0);
		adminRepository.save(admin);
	}

	@Override
	public AdminLoginResponse refreshToken(AdminRefreshTokenRequest request) {
		String token = request.getRefreshToken();

		String email;
		String type;
		try {
			email = jwtUtil.extractEmail(token);
			type = jwtUtil.extractClaims(token).get("type", String.class);
		} catch (Exception e) {
			throw new InvalidCredentialsException("Invalid refresh token");
		}

		if (email == null || !"ADMIN".equals(type)) {
			throw new InvalidCredentialsException("Invalid refresh token type");
		}

		Admin admin = adminRepository.findByEmail(email)
				.orElseThrow(() -> new InvalidCredentialsException("Admin account not found"));

		// Super Admin can never be restricted or deactivated
		if (admin.getRole() == Role.SUPER_ADMIN) {
			if (admin.getStatus() != AdminStatus.ACTIVE) {
				admin.setStatus(AdminStatus.ACTIVE);
				adminRepository.save(admin);
			}
		} else if (admin.getStatus() != AdminStatus.ACTIVE) {
			throw new InvalidCredentialsException("Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.");
		}

		String newToken = jwtUtil.generateAdminToken(admin.getEmail(), admin.getRole().name(), admin.getId());

		return AdminLoginResponse.builder()
				.adminId(admin.getId())
				.fullName(admin.getFullName())
				.email(admin.getEmail())
				.role(admin.getRole())
				.profileImage(admin.getProfileImage())
				.jwtToken(newToken)
				.build();
	}

	private void validatePasswordStrength(String password) {
		if (password == null || password.length() < 8) {
			throw new IllegalArgumentException("Password must be at least 8 characters long");
		}
		if (!password.matches(".*[A-Z].*")) {
			throw new IllegalArgumentException("Password must contain at least one uppercase letter");
		}
		if (!password.matches(".*[a-z].*")) {
			throw new IllegalArgumentException("Password must contain at least one lowercase letter");
		}
		if (!password.matches(".*\\d.*")) {
			throw new IllegalArgumentException("Password must contain at least one number");
		}
		if (!password.matches(".*[^a-zA-Z0-9].*")) {
			throw new IllegalArgumentException("Password must contain at least one special character");
		}
	}

	// Preserved Resend legacy method (to be cleaned up in a later phase)
	@SuppressWarnings("unused")
	private void sendAsyncEmail(String toEmail, String subject, String htmlContent, String otp) {
		java.util.concurrent.CompletableFuture.runAsync(() -> {
			String resendApiKey = System.getenv("RESEND_API_KEY");
			if (resendApiKey != null && !resendApiKey.isBlank()) {
				try {
					java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
					String escapedHtml = htmlContent.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
					String jsonBody = "{\"from\":\"SpeakMateAI Admin <onboarding@resend.dev>\",\"to\":[\"" + toEmail
							+ "\"],\"subject\":\"" + subject + "\",\"html\":\"" + escapedHtml + "\"}";
					java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
							.uri(java.net.URI.create("https://api.resend.com/emails"))
							.header("Authorization", "Bearer " + resendApiKey)
							.header("Content-Type", "application.json")
							.POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody))
							.build();
					java.net.http.HttpResponse<String> response = client.send(request,
							java.net.http.HttpResponse.BodyHandlers.ofString());
					System.out.println("[Resend Admin Email Sent] Status: " + response.statusCode());
				} catch (Exception ex) {
					System.err.println("[Resend Admin Email Error] " + ex.getMessage());
				}
			}
		});
	}
}
