package com.rslsolution.speakmateai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.rslsolution.speakmateai.controller.UserController;
import com.rslsolution.speakmateai.dto.request.RegisterRequest;
import com.rslsolution.speakmateai.dto.request.SpeakingMessageRequest;
import com.rslsolution.speakmateai.dto.response.SpeakingSessionResponse;
import com.rslsolution.speakmateai.dto.response.UserResponse;
import com.rslsolution.speakmateai.entity.SpeakingSession;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.ConversationFeedbackRepository;
import com.rslsolution.speakmateai.repository.ConversationMessageRepository;
import com.rslsolution.speakmateai.repository.OnboardingRepository;
import com.rslsolution.speakmateai.repository.SpeakingSessionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.impl.SpeakingSessionServiceImpl;
import com.rslsolution.speakmateai.service.impl.UserServiceImpl;
import com.rslsolution.speakmateai.util.JwtUtil;

@ExtendWith(MockitoExtension.class)
public class Phase2SecurityTest {

	@Mock
	private UserRepository userRepository;

	@Mock
	private OnboardingRepository onboardingRepository;

	@Mock
	private PasswordEncoder passwordEncoder;

	@Mock
	private SpeakingSessionRepository speakingSessionRepository;

	@Mock
	private ConversationMessageRepository messageRepository;

	@Mock
	private ConversationFeedbackRepository feedbackRepository;

	@InjectMocks
	private UserServiceImpl userService;

	@InjectMocks
	private SpeakingSessionServiceImpl speakingSessionService;

	private User userAlice;
	private User userBob;
	private SpeakingSession aliceSession;

	@BeforeEach
	void setUp() {
		userAlice = User.builder()
				.id(101L)
				.email("alice@test.com")
				.firstName("Alice")
				.lastName("Smith")
				.role(Role.USER)
				.active(true)
				.build();

		userBob = User.builder()
				.id(102L)
				.email("bob@test.com")
				.firstName("Bob")
				.lastName("Jones")
				.role(Role.USER)
				.active(true)
				.build();

		aliceSession = SpeakingSession.builder()
				.id(501L)
				.user(userAlice)
				.topic("Ordering Coffee")
				.scenario("Cafe")
				.completed(true)
				.build();
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	private void setAuthContext(String email, String role) {
		UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
				email, null, List.of(new SimpleGrantedAuthority(role)));
		SecurityContextHolder.getContext().setAuthentication(auth);
	}

	// ── Issue 4: Account-wide Operations & Ownership Tests ───────────────

	@Test
	@DisplayName("User cannot access another user's record by ID (IDOR prevention)")
	void testUserCannotAccessAnotherUserById() {
		setAuthContext("bob@test.com", "ROLE_USER");
		when(userRepository.findById(101L)).thenReturn(Optional.of(userAlice));

		assertThrows(AccessDeniedException.class, () -> {
			userService.getUserById(101L);
		});
	}

	@Test
	@DisplayName("User can access their own record by ID")
	void testUserCanAccessOwnRecordById() {
		setAuthContext("alice@test.com", "ROLE_USER");
		when(userRepository.findById(101L)).thenReturn(Optional.of(userAlice));
		when(onboardingRepository.findByUser(userAlice)).thenReturn(Optional.empty());

		UserResponse resp = userService.getUserById(101L);
		assertNotNull(resp);
		assertEquals("alice@test.com", resp.getEmail());
	}

	@Test
	@DisplayName("Admin can access any user's record by ID")
	void testAdminCanAccessAnyUserById() {
		setAuthContext("admin@speakmate.ai", "ROLE_ADMIN");
		when(userRepository.findById(101L)).thenReturn(Optional.of(userAlice));
		when(onboardingRepository.findByUser(userAlice)).thenReturn(Optional.empty());

		UserResponse resp = userService.getUserById(101L);
		assertNotNull(resp);
		assertEquals("alice@test.com", resp.getEmail());
	}

	@Test
	@DisplayName("User cannot update another user's profile (IDOR prevention)")
	void testUserCannotUpdateAnotherUserProfile() {
		setAuthContext("bob@test.com", "ROLE_USER");
		when(userRepository.findById(101L)).thenReturn(Optional.of(userAlice));

		RegisterRequest req = new RegisterRequest();
		req.setFirstName("Attacker");
		req.setLastName("Edit");
		req.setEmail("alice@test.com");

		assertThrows(AccessDeniedException.class, () -> {
			userService.updateUser(101L, req);
		});
	}

	@Test
	@DisplayName("User cannot update password via generic updateUser endpoint")
	void testUserCannotChangePasswordViaGenericUpdate() {
		setAuthContext("alice@test.com", "ROLE_USER");
		when(userRepository.findById(101L)).thenReturn(Optional.of(userAlice));

		RegisterRequest req = new RegisterRequest();
		req.setFirstName("Alice");
		req.setLastName("Smith");
		req.setEmail("alice@test.com");
		req.setPassword("NewPassword123!");

		IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
			userService.updateUser(101L, req);
		});
		assertTrue(ex.getMessage().contains("change password endpoint"));
	}

	@Test
	@DisplayName("Non-admin user cannot call getAllUsers at service level")
	void testNonAdminCannotGetAllUsers() {
		setAuthContext("alice@test.com", "ROLE_USER");

		assertThrows(AccessDeniedException.class, () -> {
			userService.getAllUsers();
		});
	}

	// ── Issue 5: Speaking Session IDOR Tests ─────────────────────────────

	@Test
	@DisplayName("User cannot view another user's speaking session by ID")
	void testUserCannotViewAnotherUserSession() {
		setAuthContext("bob@test.com", "ROLE_USER");
		when(speakingSessionRepository.findById(501L)).thenReturn(Optional.of(aliceSession));
		when(userRepository.findByEmail("bob@test.com")).thenReturn(Optional.of(userBob));

		assertThrows(AccessDeniedException.class, () -> {
			speakingSessionService.getSessionById(501L);
		});
	}

	@Test
	@DisplayName("User cannot delete another user's speaking session by ID")
	void testUserCannotDeleteAnotherUserSession() {
		setAuthContext("bob@test.com", "ROLE_USER");
		when(speakingSessionRepository.findById(501L)).thenReturn(Optional.of(aliceSession));
		when(userRepository.findByEmail("bob@test.com")).thenReturn(Optional.of(userBob));

		assertThrows(AccessDeniedException.class, () -> {
			speakingSessionService.deleteSession(501L);
		});
	}

	@Test
	@DisplayName("User cannot send message to another user's speaking session")
	void testUserCannotSendMessageToAnotherUserSession() {
		setAuthContext("bob@test.com", "ROLE_USER");
		when(speakingSessionRepository.findById(501L)).thenReturn(Optional.of(aliceSession));
		when(userRepository.findByEmail("bob@test.com")).thenReturn(Optional.of(userBob));

		SpeakingMessageRequest req = new SpeakingMessageRequest();
		req.setSessionId(501L);
		req.setMessage("Unauthorized hello");

		assertThrows(AccessDeniedException.class, () -> {
			speakingSessionService.processMessage(req);
		});
	}

	@Test
	@DisplayName("Owner can access their own speaking session")
	void testOwnerCanAccessOwnSession() {
		setAuthContext("alice@test.com", "ROLE_USER");
		when(speakingSessionRepository.findById(501L)).thenReturn(Optional.of(aliceSession));
		when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(userAlice));

		SpeakingSessionResponse resp = speakingSessionService.getSessionById(501L);
		assertNotNull(resp);
		assertEquals(501L, resp.getId());
	}

	// ── Issue 6: Password Reset Redirect XSS & Open Redirect Tests ───────

	@Test
	@DisplayName("resetRedirect rejects script injection in token parameter")
	void testResetRedirectRejectsScriptInjection() {
		UserController controller = new UserController();
		MockHttpServletRequest request = new MockHttpServletRequest();

		assertThrows(IllegalArgumentException.class, () -> {
			controller.resetRedirect("<script>alert(1)</script>", request);
		});

		assertThrows(IllegalArgumentException.class, () -> {
			controller.resetRedirect("token\" onload=\"alert(1)", request);
		});
	}

	@Test
	@DisplayName("registerExpoUrl rejects dangerous URL schemes (e.g., javascript:)")
	void testRegisterExpoUrlRejectsDangerousSchemes() {
		UserController controller = new UserController();

		assertThrows(IllegalArgumentException.class, () -> {
			controller.registerExpoUrl(java.util.Map.of("url", "javascript:alert(document.cookie)"));
		});

		assertThrows(IllegalArgumentException.class, () -> {
			controller.registerExpoUrl(java.util.Map.of("url", "data:text/html,<script>alert(1)</script>"));
		});
	}

	// ── Issue 7: JWT Expiration & Revocation Tests ────────────────────────

	@Test
	@DisplayName("Mobile JWT expiration is 30 days rather than 10 years")
	void testMobileJwtExpirationIsShortened() {
		JwtUtil jwt = new JwtUtil();
		jwt.init();

		long mobileExpiration = jwt.getExpirationForClient("MOBILE");
		long webExpiration = jwt.getExpirationForClient("WEB");

		assertEquals(2592000000L, mobileExpiration); // 30 days
		assertEquals(86400000L, webExpiration); // 24 hours
		assertTrue(mobileExpiration < 315576000000L); // Much less than 10 years!
	}

	@Test
	@DisplayName("Revoked token is rejected by isTokenValid")
	void testTokenRevocation() {
		JwtUtil jwt = new JwtUtil();
		jwt.init();

		String token = jwt.generateToken("user@test.com");
		assertTrue(jwt.isTokenValid(token, "user@test.com"));

		jwt.revokeToken(token);
		assertTrue(jwt.isTokenRevoked(token));
		assertFalse(jwt.isTokenValid(token, "user@test.com"));
	}
}
