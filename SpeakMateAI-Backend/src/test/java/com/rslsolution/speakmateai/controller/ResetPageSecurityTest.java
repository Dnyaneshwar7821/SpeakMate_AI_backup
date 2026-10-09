package com.rslsolution.speakmateai.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.rslsolution.speakmateai.dto.request.LoginRequest;
import com.rslsolution.speakmateai.dto.response.AuthResponse;
import com.rslsolution.speakmateai.service.UserService;

@ExtendWith(MockitoExtension.class)
public class ResetPageSecurityTest {

	@Mock
	private UserService userService;

	@InjectMocks
	private UserController userController;

	private MockHttpServletRequest request;
	private MockHttpServletResponse response;

	@BeforeEach
	void setUp() {
		request = new MockHttpServletRequest();
		response = new MockHttpServletResponse();
	}

	@Test
	@DisplayName("Should reject malicious XSS script tag payload in reset redirect token")
	void shouldRejectMaliciousScriptTagInToken() {
		String maliciousToken = "<script>alert(document.cookie)</script>";
		ResponseEntity<String> result = userController.resetRedirect(maliciousToken, request);

		assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
		assertNotNull(result.getBody());
		assertFalse(result.getBody().contains("<script>alert"), "HTML must NOT reflect raw script tags");
		assertTrue(result.getBody().contains("Invalid or Expired Link"));
	}

	@Test
	@DisplayName("Should reject quote breakout / JavaScript injection in reset redirect token")
	void shouldRejectQuoteBreakoutInToken() {
		String maliciousToken = "\";alert(1);//";
		ResponseEntity<String> result = userController.resetRedirect(maliciousToken, request);

		assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
		assertFalse(result.getBody().contains("\";alert(1)"), "HTML must NOT contain injected quotes");
		assertTrue(result.getBody().contains("Invalid or Expired Link"));
	}

	@Test
	@DisplayName("Should reject null or empty token in reset redirect")
	void shouldRejectNullOrEmptyToken() {
		ResponseEntity<String> nullResult = userController.resetRedirect(null, request);
		assertEquals(HttpStatus.BAD_REQUEST, nullResult.getStatusCode());

		ResponseEntity<String> emptyResult = userController.resetRedirect("", request);
		assertEquals(HttpStatus.BAD_REQUEST, emptyResult.getStatusCode());
	}

	@Test
	@DisplayName("Should safely render valid UUID token with Content-Security-Policy and data attributes")
	void shouldSafelyRenderValidToken() {
		String validToken = "c8f5e1e2-b364-4e9e-9e76-80db69c27b0b";
		request.addHeader("Host", "localhost:9091");

		ResponseEntity<String> result = userController.resetRedirect(validToken, request);

		assertEquals(HttpStatus.OK, result.getStatusCode());
		assertNotNull(result.getBody());
		assertTrue(result.getHeaders().containsKey("Content-Security-Policy"));
		assertEquals("nosniff", result.getHeaders().getFirst("X-Content-Type-Options"));
		assertEquals("DENY", result.getHeaders().getFirst("X-Frame-Options"));
		assertTrue(result.getBody().contains("data-token=\"" + validToken + "\""));
		assertFalse(result.getBody().contains("const token = \"" + validToken + "\";"), "Should not use raw inline script variable interpolation");
	}

	@Test
	@DisplayName("Should reject malicious URLs in register-expo-url")
	void shouldRejectMaliciousExpoUrl() {
		ResponseEntity<?> jsSchemeResult = userController.registerExpoUrl(Map.of("url", "javascript:alert(1)"));
		assertEquals(HttpStatus.BAD_REQUEST, jsSchemeResult.getStatusCode());

		ResponseEntity<?> quoteResult = userController.registerExpoUrl(Map.of("url", "exp://evil.com/\"><script>"));
		assertEquals(HttpStatus.BAD_REQUEST, quoteResult.getStatusCode());
	}

	@Test
	@DisplayName("Should accept valid Expo developer URL in register-expo-url")
	void shouldAcceptValidExpoUrl() {
		ResponseEntity<?> validResult = userController.registerExpoUrl(Map.of("url", "exp://192.168.1.100:8081"));
		assertEquals(HttpStatus.OK, validResult.getStatusCode());
	}

	@Test
	@DisplayName("Should attach HttpOnly cookie on login and clear it on logout")
	void shouldAttachAndClearAuthCookie() {
		LoginRequest loginReq = new LoginRequest();
		loginReq.setEmail("user@example.com");
		loginReq.setPassword("Password123!");

		AuthResponse authResponse = AuthResponse.builder()
				.token("sample.jwt.token.here")
				.build();
		when(userService.login(loginReq)).thenReturn(authResponse);

		userController.login(loginReq, request, response);

		String setCookie = response.getHeader("Set-Cookie");
		assertNotNull(setCookie, "Set-Cookie header must be present on login");
		assertTrue(setCookie.contains("speakmate_token="));
		assertTrue(setCookie.contains("HttpOnly"));

		// Test logout
		MockHttpServletResponse logoutResponse = new MockHttpServletResponse();
		ResponseEntity<?> logoutResult = userController.logout(request, logoutResponse);
		assertEquals(HttpStatus.OK, logoutResult.getStatusCode());

		String clearCookie = logoutResponse.getHeader("Set-Cookie");
		assertNotNull(clearCookie);
		assertTrue(clearCookie.contains("Max-Age=0"));
	}
}
