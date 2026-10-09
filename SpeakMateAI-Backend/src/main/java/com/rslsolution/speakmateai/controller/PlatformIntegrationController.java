package com.rslsolution.speakmateai.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rslsolution.speakmateai.dto.integration.IntegrationResponse;
import com.rslsolution.speakmateai.dto.integration.MeetingSessionResponse;
import com.rslsolution.speakmateai.dto.integration.RazorpayTestOrderResponse;
import com.rslsolution.speakmateai.dto.integration.TestConnectionResponse;
import com.rslsolution.speakmateai.dto.integration.UpdateIntegrationRequest;
import com.rslsolution.speakmateai.service.PlatformIntegrationService;
import org.springframework.security.access.prepost.PreAuthorize;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/integrations")
@PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')")
@RequiredArgsConstructor
public class PlatformIntegrationController {

	private final PlatformIntegrationService integrationService;

	@GetMapping
	public ResponseEntity<List<IntegrationResponse>> getAllIntegrations() {
		return ResponseEntity.ok(integrationService.getAllIntegrations());
	}

	@GetMapping("/{id}")
	public ResponseEntity<IntegrationResponse> getIntegration(@PathVariable String id) {
		return ResponseEntity.ok(integrationService.getIntegration(id));
	}

	@PutMapping("/{id}")
	public ResponseEntity<IntegrationResponse> updateIntegration(
			@PathVariable String id,
			@RequestBody UpdateIntegrationRequest request) {
		return ResponseEntity.ok(integrationService.updateIntegration(id, request));
	}

	@PostMapping("/{id}/test")
	public ResponseEntity<TestConnectionResponse> testConnection(@PathVariable String id) {
		return ResponseEntity.ok(integrationService.testConnection(id));
	}

	@PostMapping("/razorpay/create-test-order")
	public ResponseEntity<RazorpayTestOrderResponse> createRazorpayTestOrder() {
		return ResponseEntity.ok(integrationService.createRazorpayTestOrder());
	}

	@PostMapping("/teams/create-meeting")
	public ResponseEntity<MeetingSessionResponse> createTeamsMeeting(
			@RequestBody(required = false) Map<String, String> body) {
		String topic = (body != null) ? body.get("topic") : null;
		return ResponseEntity.ok(integrationService.createTeamsMeeting(topic));
	}

	@PostMapping("/google-meet/create-meeting")
	public ResponseEntity<MeetingSessionResponse> createGoogleMeet(
			@RequestBody(required = false) Map<String, String> body) {
		String topic = (body != null) ? body.get("topic") : null;
		return ResponseEntity.ok(integrationService.createGoogleMeet(topic));
	}
}
