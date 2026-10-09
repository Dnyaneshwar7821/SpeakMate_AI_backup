package com.rslsolution.speakmateai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rslsolution.speakmateai.assistant.ActorContext;
import com.rslsolution.speakmateai.assistant.ActorResolver;
import com.rslsolution.speakmateai.assistant.AnswerSynthesizer;
import com.rslsolution.speakmateai.assistant.provider.AssistantDataProviderRegistry;
import com.rslsolution.speakmateai.assistant.AssistantService;
import com.rslsolution.speakmateai.assistant.IntentClassifier;
import com.rslsolution.speakmateai.config.SecurityConfig;
import com.rslsolution.speakmateai.controller.AssistantController;
import com.rslsolution.speakmateai.dto.assistant.AssistantRequest;
import com.rslsolution.speakmateai.dto.assistant.AssistantResponse;
import com.rslsolution.speakmateai.dto.integration.TestConnectionResponse;
import com.rslsolution.speakmateai.dto.request.ForgotPasswordRequest;
import com.rslsolution.speakmateai.dto.request.SendDeleteAccountOtpRequest;
import com.rslsolution.speakmateai.dto.request.SendRegistrationOtpRequest;
import com.rslsolution.speakmateai.dto.request.VerifyOtpRequest;
import com.rslsolution.speakmateai.entity.PlatformIntegration;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.PlatformIntegrationRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.impl.PlatformIntegrationServiceImpl;
import com.rslsolution.speakmateai.service.impl.UserServiceImpl;
import com.rslsolution.speakmateai.service.integration.GoogleMeetIntegrationService;
import com.rslsolution.speakmateai.service.integration.MicrosoftTeamsIntegrationService;
import com.rslsolution.speakmateai.service.integration.RazorpayIntegrationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

@ExtendWith(MockitoExtension.class)
public class Phase3SecurityTest {

	@Mock
	private UserRepository userRepository;

	@InjectMocks
	private UserServiceImpl userService;

	private Validator validator;

	@BeforeEach
	void setUp() {
		ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
		validator = factory.getValidator();
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	// =========================================================================
	// ISSUE 8: OTP Rate Limiting, Throttling & Insecure Random Hardening
	// =========================================================================

	@Test
	@DisplayName("Issue 8: Registration OTP fails and invalidates after 5 incorrect attempts")
	void testRegistrationOtpThrottling() {
		String testEmail = "throttletest@example.com";
		when(userRepository.existsByEmail(testEmail)).thenReturn(false);
		when(userRepository.existsByEmailIgnoreCase(testEmail)).thenReturn(false);

		// Send registration OTP
		userService.sendRegistrationOtp(SendRegistrationOtpRequest.builder().email(testEmail).build());

		// Attempt 1 through 4 with incorrect code
		for (int i = 1; i <= 4; i++) {
			final int attempt = i;
			IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
				userService.verifyRegistrationOtp(VerifyOtpRequest.builder()
						.email(testEmail)
						.otp("99999" + attempt)
						.build());
			});
			assertTrue(ex.getMessage().contains("Invalid OTP"));
		}

		// 5th attempt with wrong OTP must exceed maximum attempts
		IllegalArgumentException ex5 = assertThrows(IllegalArgumentException.class, () -> {
			userService.verifyRegistrationOtp(VerifyOtpRequest.builder()
					.email(testEmail)
					.otp("999995")
					.build());
		});
		assertTrue(ex5.getMessage().contains("Maximum verification attempts exceeded"));

		// 6th attempt should find no active OTP (invalidated)
		IllegalArgumentException ex6 = assertThrows(IllegalArgumentException.class, () -> {
			userService.verifyRegistrationOtp(VerifyOtpRequest.builder()
					.email(testEmail)
					.otp("999996")
					.build());
		});
		assertTrue(ex6.getMessage().contains("No OTP verification code requested"));
	}

	@Test
	@DisplayName("Issue 8: Password Reset OTP fails and invalidates after 5 incorrect attempts")
	void testPasswordResetOtpThrottling() {
		String testEmail = "resetthrottletest@example.com";
		User testUser = User.builder()
				.id(101L)
				.email(testEmail)
				.firstName("Reset")
				.lastName("User")
				.resetOtp("654321")
				.resetOtpExpiry(LocalDateTime.now().plusMinutes(10))
				.resetOtpAttempts(0)
				.build();

		when(userRepository.findByEmailIgnoreCase(testEmail)).thenReturn(Optional.of(testUser));

		// 4 failed attempts
		for (int i = 1; i <= 4; i++) {
			assertThrows(IllegalArgumentException.class, () -> {
				userService.verifyOtp(VerifyOtpRequest.builder()
						.email(testEmail)
						.otp("000000")
						.build());
			});
			assertEquals(i, testUser.getResetOtpAttempts());
		}

		// 5th failed attempt invalidates OTP
		IllegalArgumentException ex5 = assertThrows(IllegalArgumentException.class, () -> {
			userService.verifyOtp(VerifyOtpRequest.builder()
					.email(testEmail)
					.otp("000000")
					.build());
		});
		assertTrue(ex5.getMessage().contains("Maximum OTP verification attempts exceeded"));
		assertEquals(null, testUser.getResetOtp());
	}

	@Test
	@DisplayName("Issue 8: OTP request cooldown prevents rapid spamming")
	void testOtpCooldown() {
		String testEmail = "cooldowntest@example.com";
		when(userRepository.existsByEmail(testEmail)).thenReturn(false);
		when(userRepository.existsByEmailIgnoreCase(testEmail)).thenReturn(false);

		// First request succeeds
		userService.sendRegistrationOtp(SendRegistrationOtpRequest.builder().email(testEmail).build());

		// Immediate second request must trigger cooldown
		IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
			userService.sendRegistrationOtp(SendRegistrationOtpRequest.builder().email(testEmail).build());
		});
		assertTrue(ex.getMessage().contains("Please wait") && ex.getMessage().contains("seconds"));
	}

	// =========================================================================
	// ISSUE 9: Assistant Privacy & Request Bounds Validation
	// =========================================================================

	@Test
	@DisplayName("Issue 9: AssistantRequest enforces message max length 2000 chars")
	void testAssistantRequestBoundsValidation() {
		String oversizedMessage = "A".repeat(2001);
		AssistantRequest req = AssistantRequest.builder()
				.message(oversizedMessage)
				.sessionId("valid-session")
				.build();

		Set<ConstraintViolation<AssistantRequest>> violations = validator.validate(req);
		assertFalse(violations.isEmpty());
		assertTrue(violations.stream().anyMatch(v -> v.getMessage().contains("2000 characters")));

		// Valid message passes
		AssistantRequest validReq = AssistantRequest.builder()
				.message("Hello SpeakMate!")
				.sessionId("valid-session")
				.build();
		Set<ConstraintViolation<AssistantRequest>> validViolations = validator.validate(validReq);
		assertTrue(validViolations.isEmpty());
	}

	@Test
	@DisplayName("Issue 9: AssistantRequest enforces history max length 30 turns")
	void testAssistantHistoryBoundsValidation() {
		List<AssistantRequest.MessageTurn> turns = new ArrayList<>();
		for (int i = 0; i < 35; i++) {
			turns.add(new AssistantRequest.MessageTurn("user", "turn " + i));
		}

		AssistantRequest req = AssistantRequest.builder()
				.message("Hello")
				.history(turns)
				.build();

		Set<ConstraintViolation<AssistantRequest>> violations = validator.validate(req);
		assertFalse(violations.isEmpty());
		assertTrue(violations.stream().anyMatch(v -> v.getMessage().contains("30 turns")));
	}

	@Test
	@DisplayName("Issue 9: Assistant rate limiter throttles callers exceeding 30 requests per minute")
	void testAssistantRateLimiting() {
		ActorResolver actorResolver = mock(ActorResolver.class);
		IntentClassifier intentClassifier = mock(IntentClassifier.class);
		AnswerSynthesizer answerSynthesizer = mock(AnswerSynthesizer.class);
		AssistantDataProviderRegistry registry = mock(AssistantDataProviderRegistry.class);

		ActorContext mockActor = ActorContext.builder()
				.email("ratelimit@example.com")
				.role(Role.USER)
				.build();
		when(actorResolver.resolve("ratelimit@example.com")).thenReturn(mockActor);

		AssistantService assistantService = new AssistantService(actorResolver, intentClassifier, answerSynthesizer, registry);

		AssistantRequest req = AssistantRequest.builder()
				.message("Who are you?")
				.build();

		// Fire 30 requests - should succeed (fast path chatbot identity or similar)
		for (int i = 0; i < 30; i++) {
			AssistantResponse resp = assistantService.answer("ratelimit@example.com", req);
			assertNotNull(resp);
		}

		// 31st request must trigger rate limit
		AssistantResponse throttled = assistantService.answer("ratelimit@example.com", req);
		assertFalse(throttled.isSuccess());
		assertEquals("Rate limit exceeded", throttled.getErrorMessage());
	}

	// =========================================================================
	// ISSUE 10: Assistant Pipeline Failure Error Handling
	// =========================================================================

	@Test
	@DisplayName("Issue 10: Assistant pipeline failure returns HTTP 503 instead of 200 OK")
	void testAssistantPipelineFailureHttpStatus() {
		AssistantService mockAssistantService = mock(AssistantService.class);
		AssistantController controller = new AssistantController(mockAssistantService);

		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken("testuser@example.com", null, Collections.emptyList()));

		AssistantRequest req = AssistantRequest.builder().message("Test message").build();

		// When assistant service returns failure
		AssistantResponse errorResponse = AssistantResponse.builder()
				.success(false)
				.errorMessage("Assistant pipeline failure: Connection timed out")
				.markdown("Temporary issue")
				.build();
		when(mockAssistantService.answer("testuser@example.com", req)).thenReturn(errorResponse);

		ResponseEntity<AssistantResponse> entity = controller.message(req);
		assertEquals(HttpStatus.SERVICE_UNAVAILABLE, entity.getStatusCode());
		assertFalse(entity.getBody().isSuccess());

		// When rate limited, controller returns 429 TOO_MANY_REQUESTS
		AssistantResponse rateLimitedResponse = AssistantResponse.builder()
				.success(false)
				.errorMessage("Rate limit exceeded")
				.markdown("Too fast")
				.build();
		when(mockAssistantService.answer("testuser@example.com", req)).thenReturn(rateLimitedResponse);

		ResponseEntity<AssistantResponse> rateLimitedEntity = controller.message(req);
		assertEquals(HttpStatus.TOO_MANY_REQUESTS, rateLimitedEntity.getStatusCode());
	}

	// =========================================================================
	// ISSUE 11: Integration Health Checks Real Connection / Credentials Check
	// =========================================================================

	@Test
	@DisplayName("Issue 11: Unknown integrations and unconfigured providers return unverified/unsupported state")
	void testPlatformIntegrationHealthChecks() {
		PlatformIntegrationRepository repo = mock(PlatformIntegrationRepository.class);
		RazorpayIntegrationService razorpay = mock(RazorpayIntegrationService.class);
		MicrosoftTeamsIntegrationService teams = mock(MicrosoftTeamsIntegrationService.class);
		GoogleMeetIntegrationService meet = mock(GoogleMeetIntegrationService.class);
		ObjectMapper objectMapper = new ObjectMapper();

		PlatformIntegrationServiceImpl service = new PlatformIntegrationServiceImpl(repo, razorpay, teams, meet, objectMapper);

		// 1. Unknown integration
		when(repo.findByIntegrationId("unknown_service")).thenReturn(Optional.empty());
		TestConnectionResponse unknownResp = service.testConnection("unknown_service");
		assertFalse(unknownResp.isSuccess());
		assertTrue(unknownResp.getMessage().contains("Unsupported integration ID"));

		// 2. WhatsApp without credentials
		PlatformIntegration whatsappEntity = PlatformIntegration.builder()
				.integrationId("whatsapp")
				.status("connected")
				.configData("{}")
				.build();
		when(repo.findByIntegrationId("whatsapp")).thenReturn(Optional.of(whatsappEntity));

		TestConnectionResponse waResp = service.testConnection("whatsapp");
		assertFalse(waResp.isSuccess());
		assertTrue(waResp.getMessage().contains("Unverified"));
		assertEquals("error", whatsappEntity.getStatus());

		// 3. Twilio SMS without credentials
		PlatformIntegration twilioEntity = PlatformIntegration.builder()
				.integrationId("twilio_sms")
				.status("connected")
				.configData("{}")
				.build();
		when(repo.findByIntegrationId("twilio_sms")).thenReturn(Optional.of(twilioEntity));

		TestConnectionResponse twilioResp = service.testConnection("twilio_sms");
		assertFalse(twilioResp.isSuccess());
		assertTrue(twilioResp.getMessage().contains("Unverified"));
		assertEquals("error", twilioEntity.getStatus());

		// 4. Discord without credentials
		PlatformIntegration discordEntity = PlatformIntegration.builder()
				.integrationId("discord")
				.status("connected")
				.configData("{}")
				.build();
		when(repo.findByIntegrationId("discord")).thenReturn(Optional.of(discordEntity));

		TestConnectionResponse discordResp = service.testConnection("discord");
		assertFalse(discordResp.isSuccess());
		assertTrue(discordResp.getMessage().contains("Unverified"));
		assertEquals("error", discordEntity.getStatus());

		// 5. Zapier without webhook URL
		PlatformIntegration zapierEntity = PlatformIntegration.builder()
				.integrationId("zapier")
				.status("connected")
				.configData("{}")
				.build();
		when(repo.findByIntegrationId("zapier")).thenReturn(Optional.of(zapierEntity));

		TestConnectionResponse zapierResp = service.testConnection("zapier");
		assertFalse(zapierResp.isSuccess());
		assertTrue(zapierResp.getMessage().contains("Unverified"));
		assertEquals("error", zapierEntity.getStatus());
	}

	// =========================================================================
	// ISSUE 12: CORS Lockdown Verification
	// =========================================================================

	@Test
	@DisplayName("Issue 12: CORS configuration restricts origins, methods, and headers")
	void testCorsLockdown() {
		SecurityConfig securityConfig = new SecurityConfig(null, null, null);
		CorsConfigurationSource source = securityConfig.corsConfigurationSource();

		org.springframework.mock.web.MockHttpServletRequest mockRequest = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/assistant/message");
		CorsConfiguration config = source.getCorsConfiguration(mockRequest);
		assertNotNull(config);

		// Methods must NOT be wildcard "*"
		assertFalse(config.getAllowedMethods().contains("*"));
		assertTrue(config.getAllowedMethods().contains("GET"));
		assertTrue(config.getAllowedMethods().contains("POST"));
		assertTrue(config.getAllowedMethods().contains("PUT"));
		assertTrue(config.getAllowedMethods().contains("DELETE"));

		// Headers must NOT be wildcard "*"
		assertFalse(config.getAllowedHeaders().contains("*"));
		assertTrue(config.getAllowedHeaders().contains("Authorization"));
		assertTrue(config.getAllowedHeaders().contains("Content-Type"));

		// Origin patterns must not be wildcard "*"
		assertFalse(config.getAllowedOriginPatterns().contains("*"));
		assertTrue(config.getAllowedOriginPatterns().contains("http://localhost:5173"));
		assertTrue(config.getAllowedOriginPatterns().contains("https://*.onrender.com"));
	}
}
