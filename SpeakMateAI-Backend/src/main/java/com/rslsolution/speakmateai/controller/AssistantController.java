package com.rslsolution.speakmateai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rslsolution.speakmateai.assistant.AssistantService;
import com.rslsolution.speakmateai.dto.assistant.AssistantRequest;
import com.rslsolution.speakmateai.dto.assistant.AssistantResponse;

import jakarta.validation.Valid;

/**
 * SpeakMate AI assistant endpoint, available to all four roles
 * (Super Admin, School Admin, Teacher, Student). Role scoping is enforced by
 * {@link AssistantService}; other roles are rejected by Spring Security
 * (see {@code /api/assistant/**} rule in SecurityConfig).
 *
 * <p>Stateless by design: no persistence, no schema changes, no DB writes.
 */
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

	private final AssistantService assistantService;

	public AssistantController(AssistantService assistantService) {
		this.assistantService = assistantService;
	}

	@PostMapping("/message")
	public ResponseEntity<AssistantResponse> message(@Valid @RequestBody AssistantRequest request) {
		String email = currentPrincipalEmail();
		AssistantResponse response = assistantService.answer(email, request);
		if (!response.isSuccess()) {
			if (response.getErrorMessage() != null && response.getErrorMessage().contains("Rate limit")) {
				return ResponseEntity.status(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS).body(response);
			}
			return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).body(response);
		}
		return ResponseEntity.ok(response);
	}

	private String currentPrincipalEmail() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
			throw new IllegalArgumentException("Authenticated principal not found.");
		}
		return authentication.getName();
	}
}
