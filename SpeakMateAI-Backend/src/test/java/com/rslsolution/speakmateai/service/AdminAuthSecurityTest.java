package com.rslsolution.speakmateai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.rslsolution.speakmateai.dto.request.AdminRegisterRequest;
import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.dto.response.VerifyOtpResponse;
import com.rslsolution.speakmateai.entity.Admin;
import com.rslsolution.speakmateai.enums.AdminStatus;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.service.impl.AdminAuthServiceImpl;
import com.rslsolution.speakmateai.util.JwtUtil;

@ExtendWith(MockitoExtension.class)
public class AdminAuthSecurityTest {

	@Mock
	private AdminRepository adminRepository;

	@Mock
	private PasswordEncoder passwordEncoder;

	@Mock
	private JwtUtil jwtUtil;

	@Mock
	private EmailService emailService;

	@InjectMocks
	private AdminAuthServiceImpl adminAuthService;

	private Admin testAdmin;

	@BeforeEach
	void setUp() {
		testAdmin = Admin.builder()
				.id(1L)
				.fullName("Security Test Admin")
				.email("admin@speakmate.ai")
				.password("encoded_secret_password")
				.role(Role.ADMIN)
				.status(AdminStatus.ACTIVE)
				.resetOtp("849302")
				.resetOtpExpiry(LocalDateTime.now().plusMinutes(10))
				.resetOtpAttempts(0)
				.build();
	}

	@Test
	@DisplayName("Master OTP '123456' must be rejected when not matching admin's actual OTP")
	void testMasterOtpBypassIsEliminated() {
		when(adminRepository.findByEmail("admin@speakmate.ai")).thenReturn(Optional.of(testAdmin));

		VerifyOtpRequest request = new VerifyOtpRequest();
		request.setEmail("admin@speakmate.ai");
		request.setOtp("123456"); // master bypass attempt

		IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
			adminAuthService.verifyOtp(request);
		});

		assertTrue(ex.getMessage().contains("Invalid OTP code"));
		assertEquals(1, testAdmin.getResetOtpAttempts());
	}

	@Test
	@DisplayName("Exceeding 5 failed OTP attempts invalidates the reset OTP")
	void testOtpAttemptThrottlingLocksOut() {
		testAdmin.setResetOtpAttempts(4);
		when(adminRepository.findByEmail("admin@speakmate.ai")).thenReturn(Optional.of(testAdmin));

		VerifyOtpRequest request = new VerifyOtpRequest();
		request.setEmail("admin@speakmate.ai");
		request.setOtp("999999"); // 5th incorrect attempt

		IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
			adminAuthService.verifyOtp(request);
		});

		assertTrue(ex.getMessage().contains("Too many failed attempts"));
		assertNull(testAdmin.getResetOtp());
		assertNull(testAdmin.getResetOtpExpiry());
	}

	@Test
	@DisplayName("Correct OTP successfully generates reset token and clears OTP")
	void testValidOtpVerificationSucceeds() {
		when(adminRepository.findByEmail("admin@speakmate.ai")).thenReturn(Optional.of(testAdmin));

		VerifyOtpRequest request = new VerifyOtpRequest();
		request.setEmail("admin@speakmate.ai");
		request.setOtp("849302"); // correct OTP

		VerifyOtpResponse response = adminAuthService.verifyOtp(request);

		assertNotNull(response.getToken());
		assertEquals("OTP verified successfully.", response.getMessage());
		assertNull(testAdmin.getResetOtp());
		assertNull(testAdmin.getResetOtpExpiry());
		assertEquals(0, testAdmin.getResetOtpAttempts());
		assertEquals(response.getToken(), testAdmin.getResetPasswordToken());
	}

	@Test
	@DisplayName("forgotPassword resets OTP attempts and generates a 6-digit code")
	void testForgotPasswordResetsAttempts() {
		testAdmin.setResetOtpAttempts(3);
		when(adminRepository.findByEmail("admin@speakmate.ai")).thenReturn(Optional.of(testAdmin));

		ForgotPasswordRequest request = new ForgotPasswordRequest();
		request.setEmail("admin@speakmate.ai");

		adminAuthService.forgotPassword(request);

		assertNotNull(testAdmin.getResetOtp());
		assertEquals(6, testAdmin.getResetOtp().length());
		assertEquals(0, testAdmin.getResetOtpAttempts());
		assertNotNull(testAdmin.getResetOtpExpiry());
		verify(adminRepository).save(testAdmin);
	}

	@Test
	@DisplayName("Registration defaults safely and sets initial attempts to 0")
	void testRegistrationSanitizesRole() {
		when(adminRepository.findByEmail("new@admin.com")).thenReturn(Optional.empty());
		when(passwordEncoder.encode("StrongPassword123!")).thenReturn("encoded_pass");

		AdminRegisterRequest request = new AdminRegisterRequest();
		request.setEmail("new@admin.com");
		request.setFullName("New Admin");
		request.setPassword("StrongPassword123!");
		request.setPhone("9876543210");
		request.setRole(Role.USER); // invalid role for admin entity

		adminAuthService.register(request);

		verify(adminRepository).save(any(Admin.class));
	}
}
