package com.rslsolution.speakmateai.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.rslsolution.speakmateai.dto.request.ChatRenameRequest;
import com.rslsolution.speakmateai.dto.request.ChatSessionMessageRequest;
import com.rslsolution.speakmateai.dto.request.ChatStartRequest;
import com.rslsolution.speakmateai.dto.response.ChatMessageResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionDetailResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionFinishResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionResponse;
import com.rslsolution.speakmateai.service.AIChatService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class AIChatController {

	private final AIChatService aiChatService;

	public AIChatController(AIChatService aiChatService) {
		this.aiChatService = aiChatService;
	}

	@GetMapping("/history")
	public List<ChatSessionResponse> getChatHistory() {
		return aiChatService.getChatHistory();
	}

	@GetMapping("/session/{id}")
	public ChatSessionDetailResponse getSessionDetail(@PathVariable Long id) {
		return aiChatService.getSessionDetail(id);
	}

	@PostMapping("/start")
	public ChatSessionResponse startSession(@Valid @RequestBody ChatStartRequest request) {
		return aiChatService.startSession(request);
	}

	@PostMapping("/message")
	public ChatMessageResponse sendMessage(@Valid @RequestBody ChatSessionMessageRequest request) {
		return aiChatService.processMessage(request);
	}

	@DeleteMapping("/session/{id}")
	public String deleteSession(@PathVariable Long id) {
		aiChatService.deleteSession(id);
		return "Chat session deleted successfully.";
	}

	@PutMapping("/session/{id}/rename")
	public ChatSessionResponse renameSession(@PathVariable Long id, @Valid @RequestBody ChatRenameRequest request) {
		return aiChatService.renameSession(id, request);
	}

	@PostMapping("/bookmark/{messageId}")
	public boolean toggleBookmark(@PathVariable Long messageId) {
		return aiChatService.toggleBookmark(messageId);
	}

	@GetMapping("/bookmarks")
	public List<ChatMessageResponse> getBookmarkedMessages() {
		return aiChatService.getBookmarkedMessages();
	}

	@GetMapping("/hint/{id}")
	public List<String> getHints(@PathVariable Long id) {
		return aiChatService.getHints(id);
	}

	@PostMapping("/session/{id}/finish")
	public ChatSessionFinishResponse finishSession(@PathVariable Long id) {
		return aiChatService.finishSession(id);
	}
}
