package com.rslsolution.speakmateai.service.impl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rslsolution.speakmateai.dto.request.ChatRenameRequest;
import com.rslsolution.speakmateai.dto.request.ChatSessionMessageRequest;
import com.rslsolution.speakmateai.dto.request.ChatStartRequest;
import com.rslsolution.speakmateai.dto.groq.GroqRequest;
import com.rslsolution.speakmateai.dto.response.ChatMessageResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionDetailResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionFinishResponse;
import com.rslsolution.speakmateai.dto.response.ChatSessionResponse;
import com.rslsolution.speakmateai.dto.groq.GroqResponse;
import com.rslsolution.speakmateai.entity.ChatBookmark;
import com.rslsolution.speakmateai.entity.ChatMessage;
import com.rslsolution.speakmateai.entity.ChatSession;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.ChatBookmarkRepository;
import com.rslsolution.speakmateai.repository.ChatMessageRepository;
import com.rslsolution.speakmateai.repository.ChatSessionRepository;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.AIChatService;

@Service
@Transactional
public class AIChatServiceImpl implements AIChatService {

	private final ChatSessionRepository chatSessionRepository;
	private final ChatMessageRepository chatMessageRepository;
	private final ChatBookmarkRepository chatBookmarkRepository;
	private final UserRepository userRepository;
	private final RestTemplate restTemplate;
	private final ObjectMapper objectMapper = new ObjectMapper();

	@Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}")
	private String apiUrl;

	@Value("${groq.api.key:}")
	private String apiKey;

	@Value("${groq.model.chat:${groq.model:openai/gpt-oss-120b}}")
	private String model;

	private final ProgressRepository progressRepository;

	public AIChatServiceImpl(
			ChatSessionRepository chatSessionRepository,
			ChatMessageRepository chatMessageRepository,
			ChatBookmarkRepository chatBookmarkRepository,
			UserRepository userRepository,
			RestTemplate restTemplate,
			ProgressRepository progressRepository) {
		this.chatSessionRepository = chatSessionRepository;
		this.chatMessageRepository = chatMessageRepository;
		this.chatBookmarkRepository = chatBookmarkRepository;
		this.userRepository = userRepository;
		this.restTemplate = restTemplate;
		this.progressRepository = progressRepository;
	}

	private User currentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
			throw new UserNotFoundException("User not authenticated");
		}
		return userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));
	}

	@Override
	public List<ChatSessionResponse> getChatHistory() {
		User user = currentUser();
		return chatSessionRepository.findByUserOrderByUpdatedAtDesc(user).stream()
				.map(s -> ChatSessionResponse.builder()
						.id(s.getId())
						.mode(s.getMode())
						.title(s.getTitle())
						.messageCount(s.getMessages().size())
						.createdAt(s.getCreatedAt())
						.updatedAt(s.getUpdatedAt())
						.build())
				.toList();
	}

	@Override
	public ChatSessionDetailResponse getSessionDetail(Long id) {
		User user = currentUser();
		ChatSession session = chatSessionRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Chat session not found"));

		if (!session.getUser().getId().equals(user.getId())) {
			throw new SecurityException("Unauthorized access to chat session");
		}

		List<ChatMessageResponse> messages = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session).stream()
				.map(m -> ChatMessageResponse.builder()
						.id(m.getId())
						.sender(m.getSender())
						.message(m.getMessage())
						.voiceEnabled(m.isVoiceEnabled())
						.grammarCorrection(m.getGrammarCorrection())
						.betterSentence(m.getBetterSentence())
						.vocabularySuggestions(m.getVocabularySuggestions())
						.explanation(m.getExplanation())
						.followUpQuestion(m.getFollowUpQuestion())
						.bookmarked(chatBookmarkRepository.existsByUserAndMessage(user, m))
						.createdAt(m.getCreatedAt())
						.build())
				.toList();

		return ChatSessionDetailResponse.builder()
				.id(session.getId())
				.mode(session.getMode())
				.title(session.getTitle())
				.createdAt(session.getCreatedAt())
				.messages(messages)
				.build();
	}

	@Override
	public ChatSessionResponse startSession(ChatStartRequest request) {
		User user = currentUser();

		String modeName = (request != null && request.getMode() != null && !request.getMode().trim().isEmpty())
				? request.getMode().trim()
				: "General";

		String defaultTitle = modeName + " Session";

		ChatSession session = ChatSession.builder()
				.user(user)
				.mode(modeName)
				.title(defaultTitle)
				.build();

		ChatSession saved = chatSessionRepository.save(session);

		// AI Introduces session with user context
		String intro;
		try {
			List<GroqRequest.Message> messages = new ArrayList<>();
			String userContext = buildUserContextInstruction(user, modeName);
			String sysPrompt = String.format(
					"You are SpeakMateAI, a friendly and adaptive English tutor.\n" +
					"Start a live practice conversation for the scenario/mode: '%s'.\n" +
					"%s\n" +
					"Briefly introduce yourself and ask ONE warm opening question specifically suited to the student's age/standard and scenario.\n" +
					"Keep it warm and under 2 sentences. Never output JSON.",
					modeName,
					userContext
			);
			messages.add(new GroqRequest.Message("system", sysPrompt));
			messages.add(new GroqRequest.Message("user", "Hello tutor, let's start."));

			intro = callGroqChat(messages);
			if (intro == null || intro.trim().isEmpty()) {
				intro = "Hello! I am SpeakMateAI, your English tutor for " + modeName + ". What would you like to practice today?";
			}
		} catch (Exception e) {
			intro = "Hello! I am SpeakMateAI, your English tutor for " + modeName + ". What would you like to practice today?";
		}

		ChatMessage aiMsg = ChatMessage.builder()
				.session(saved)
				.sender("ai")
				.message(intro)
				.voiceEnabled(false)
				.build();
		chatMessageRepository.save(aiMsg);

		return ChatSessionResponse.builder()
				.id(saved.getId())
				.mode(saved.getMode())
				.title(saved.getTitle())
				.messageCount(1)
				.createdAt(saved.getCreatedAt())
				.updatedAt(saved.getUpdatedAt())
				.build();
	}

	@Override
	public ChatMessageResponse processMessage(ChatSessionMessageRequest request) {
		User user = currentUser();
		ChatSession session = chatSessionRepository.findById(request.getSessionId())
				.orElseThrow(() -> new IllegalArgumentException("Chat session not found"));

		if (!session.getUser().getId().equals(user.getId())) {
			throw new SecurityException("Unauthorized access to chat session");
		}

		// 1. Save User's Message
		ChatMessage userMsg = ChatMessage.builder()
				.session(session)
				.sender("user")
				.message(request.getMessage())
				.voiceEnabled(request.isVoiceEnabled())
				.build();
		chatMessageRepository.save(userMsg);


		// 2. Determine Level
		String chatLevel = request.getLevel();
		if (chatLevel == null || chatLevel.trim().isEmpty()) {
			chatLevel = user.getEnglishLevel();
		}
		if (chatLevel == null || chatLevel.trim().isEmpty()) {
			chatLevel = "Beginner";
		}

		String normalizedLevel = chatLevel.trim();
		if (normalizedLevel.matches("(?i).*level\\s*\\d+.*|\\d+")) {
			java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(normalizedLevel);
			if (m.find()) {
				int lvl = Integer.parseInt(m.group());
				if (lvl <= 2) normalizedLevel = "Beginner";
				else if (lvl <= 4) normalizedLevel = "Intermediate";
				else normalizedLevel = "Advanced";
			}
		}

		String levelInstruction = "";
		if ("Beginner".equalsIgnoreCase(normalizedLevel) || normalizedLevel.toLowerCase().contains("beginner") || normalizedLevel.toLowerCase().contains("a1") || normalizedLevel.toLowerCase().contains("a2")) {
			levelInstruction = "Current Learner English Level: Beginner.\n" +
					"Instructions: Use extremely simple, clear, and common vocabulary (A1-A2 levels). Speak in very short, basic sentences. Keep your grammar explanations as simple and concrete as possible.\n";
		} else if ("Intermediate".equalsIgnoreCase(normalizedLevel) || normalizedLevel.toLowerCase().contains("intermediate") || normalizedLevel.toLowerCase().contains("b1") || normalizedLevel.toLowerCase().contains("b2")) {
			levelInstruction = "Current Learner English Level: Intermediate.\n" +
					"Instructions: Use everyday conversational English, standard sentence lengths, and B1-B2 vocabulary. Introduce occasional common idioms with clear, practical explanations.\n";
		} else { // Advanced
			levelInstruction = "Current Learner English Level: Advanced.\n" +
					"Instructions: Use sophisticated and diverse vocabulary (C1-C2 levels). Use complex and varied sentence structures, advanced idioms, and nuanced phrasing suggestions.\n";
		}


		// 3. Fetch last 10 messages for context
		List<ChatMessage> history = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session);

		String userContextInstruction = buildUserContextInstruction(user, session.getMode());

		List<GroqRequest.Message> groqMessages = new ArrayList<>();
		String systemPrompt = String.format(
				"You are SpeakMateAI, a world-class personal AI English Tutor having a live one-on-one conversation.\n" +
				"Your personality is warm, enthusiastic, empathetic, and extremely conversational.\n\n" +
				"LEARNER CONTEXT & SCENARIO:\n" +
				"Active Tutoring Mode: %s\n" +
				"%s\n" +
				"%s\n\n" +
				"KEY TEACHING GUIDELINES:\n" +
				"1. KEEP REPLIES SHORT & NATURAL: Your [REPLY] must be EXACTLY 1 to 2 short conversational sentences (under 30 words total). Never write long paragraphs, lectures, essays, or multiple thoughts.\n" +
				"2. Always ask ONE concise, engaging follow-up question in [FOLLOWUP] (under 15 words) to keep the conversation flowing smoothly.\n" +
				"3. Provide polite, brief grammar corrections in [GRAMMAR] only when there are actual errors (or 'None').\n" +
				"4. Suggest 1 natural native phrasing in [BETTER_SENTENCE] (or 'None').\n" +
				"5. Suggest 1-2 rich vocabulary words with brief definitions in [VOCABULARY] (or 'None').\n" +
				"6. Provide a 1-sentence friendly tip in [EXPLANATION] (or 'None').\n" +
				"7. Tailor your tone, vocabulary, and pacing strictly to the learner's English level and age/standard.\n" +
				"8. Never output JSON, code blocks, or raw markdown headers. Stick strictly to the tag format.\n\n" +
				"RESPONSE FORMAT (STRICT):\n" +
				"[REPLY] Your warm in-character conversational response (1-2 sentences maximum, under 30 words).\n" +
				"[GRAMMAR] The corrected version of their sentence with a brief tip, or 'None' if already correct.\n" +
				"[BETTER_SENTENCE] How a native speaker would express the same idea naturally, or 'None'.\n" +
				"[VOCABULARY] 1-2 useful topic-related words or idioms with short definitions, or 'None'.\n" +
				"[EXPLANATION] A friendly 1-sentence tip explaining the nuance or phrasing, or 'None'.\n" +
				"[FOLLOWUP] Exactly ONE short natural follow-up question to keep the conversation moving forward.\n\n" +
				"[SUGGESTIONS] EXACTLY 3 short, realistic alternative responses (each under 10 words) separated by ' | ' that the student could say next to answer your question.",
				session.getMode(),
				levelInstruction,
				userContextInstruction
		);
		groqMessages.add(new GroqRequest.Message("system", systemPrompt));

		// Add last 10 messages
		int startIdx = Math.max(0, history.size() - 10);
		for (int i = startIdx; i < history.size(); i++) {
			ChatMessage m = history.get(i);
			String role = m.getSender().equals("user") ? "user" : "assistant";
			groqMessages.add(new GroqRequest.Message(role, m.getMessage()));
		}

		String rawResponse;
		try {
			rawResponse = callGroqChat(groqMessages);
			if (rawResponse == null || rawResponse.trim().isEmpty()) {
				rawResponse = "[REPLY] That's a great thought! Can you share more about that?\n[GRAMMAR] None\n[BETTER_SENTENCE] None\n[VOCABULARY] None\n[EXPLANATION] None\n[FOLLOWUP] What else comes to mind?\n[SUGGESTIONS] I'd love to tell you more. | Could you give me an example? | What do you recommend?";
			}
		} catch (Exception e) {
			rawResponse = "[REPLY] That's a great thought! Can you tell me a little more about that?\n[GRAMMAR] None\n[BETTER_SENTENCE] None\n[VOCABULARY] None\n[EXPLANATION] None\n[FOLLOWUP] What would you like to explore next?\n[SUGGESTIONS] I'd love to share more. | What should we discuss next? | Could you give me an example?";
		}

		// 4. Parse tag contents
		String reply = extractTagContent(rawResponse, "[REPLY]", "[GRAMMAR]", "[BETTER_SENTENCE]", "[VOCABULARY]", "[EXPLANATION]", "[FOLLOWUP]", "[SUGGESTIONS]");
		String grammar = extractTagContent(rawResponse, "[GRAMMAR]", "[BETTER_SENTENCE]", "[VOCABULARY]", "[EXPLANATION]", "[FOLLOWUP]", "[SUGGESTIONS]");
		String better = extractTagContent(rawResponse, "[BETTER_SENTENCE]", "[VOCABULARY]", "[EXPLANATION]", "[FOLLOWUP]", "[SUGGESTIONS]");
		String vocab = extractTagContent(rawResponse, "[VOCABULARY]", "[EXPLANATION]", "[FOLLOWUP]", "[SUGGESTIONS]");
		String explanation = extractTagContent(rawResponse, "[EXPLANATION]", "[FOLLOWUP]", "[SUGGESTIONS]");
		String followup = extractTagContent(rawResponse, "[FOLLOWUP]", "[SUGGESTIONS]");
		String suggestionsRaw = extractTagContent(rawResponse, "[SUGGESTIONS]");

		// Parse dynamic suggestions
		List<String> suggestedList = new ArrayList<>();
		if (suggestionsRaw != null && !suggestionsRaw.equalsIgnoreCase("none") && !suggestionsRaw.trim().isEmpty()) {
			String[] parts = suggestionsRaw.split("\\|");
			for (String p : parts) {
				String clean = p.replaceAll("(?i)^(suggestion|option|hint|choice)\\s*\\d*\\s*[:\\-.]?\\s*", "")
								.replaceAll("^\\d+[\\.\\)]\\s*", "")
								.replaceAll("^[\"']+|[\"']+$", "").trim();
				if (!clean.isEmpty() && !clean.toLowerCase().startsWith("suggestion") && !suggestedList.contains(clean)) {
					suggestedList.add(clean);
				}
			}
		}
		if (suggestedList.isEmpty()) {
			suggestedList = generateContextualFallbacks(session.getMode(), reply, followup);
		}

		// Clean up defaults
		if (reply == null || reply.trim().isEmpty()) {
			reply = rawResponse; // Fallback
		}
		if (better != null && (better.equalsIgnoreCase("none") || better.equalsIgnoreCase("null") || better.trim().isEmpty())) {
			better = null;
		} else if (better != null) {
			better = better.replaceAll("^[\"']+|[\"']+$", "").trim();
		}
		if (vocab != null && (vocab.equalsIgnoreCase("none") || vocab.equalsIgnoreCase("null") || vocab.trim().isEmpty())) {
			vocab = null;
		}
		if (explanation != null && (explanation.equalsIgnoreCase("none") || explanation.equalsIgnoreCase("null") || explanation.trim().isEmpty())) {
			explanation = null;
		}
		if (followup != null && (followup.equalsIgnoreCase("none") || followup.equalsIgnoreCase("null") || followup.trim().isEmpty())) {
			followup = null;
		} else if (followup != null) {
			followup = followup.replaceAll("^[\"']+|[\"']+$", "").trim();
		}

		// Grammar Correction logic
		String userClean = request.getMessage().trim().replaceAll("[\\p{Punct}&&[^']]+", "").replaceAll("\\s+", " ").toLowerCase();
		String grammarClean = (grammar != null) ? grammar.trim().replaceAll("[\\p{Punct}&&[^']]+", "").replaceAll("\\s+", " ").toLowerCase() : "";

		if (grammar == null || grammar.equalsIgnoreCase("none") || grammar.equalsIgnoreCase("null") || grammar.trim().isEmpty()) {
			grammar = "✅ Your sentence is correct.";
		} else if (grammarClean.equals(userClean)) {
			grammar = "✅ Your sentence is correct.";
		}

		// Deduplicate follow-up from reply
		if (reply != null && followup != null && !followup.isEmpty()) {
			String replyTrim = reply.trim();
			String followupTrim = followup.trim();
			if (replyTrim.endsWith(followupTrim)) {
				reply = replyTrim.substring(0, replyTrim.length() - followupTrim.length()).trim();
			} else if (replyTrim.contains(followupTrim)) {
				reply = replyTrim.replace(followupTrim, "").trim();
			}
		}

		// 5. Save AI Response
		ChatMessage aiMsg = ChatMessage.builder()
				.session(session)
				.sender("ai")
				.message(reply)
				.voiceEnabled(request.isVoiceEnabled())
				.grammarCorrection(grammar)
				.betterSentence(better)
				.vocabularySuggestions(vocab)
				.explanation(explanation)
				.followUpQuestion(followup)
				.build();
		ChatMessage savedAiMsg = chatMessageRepository.save(aiMsg);

		// Touch updated timestamp on session
		session.setUpdatedAt(LocalDateTime.now());
		chatSessionRepository.save(session);

		return ChatMessageResponse.builder()
				.id(savedAiMsg.getId())
				.sender("ai")
				.message(savedAiMsg.getMessage())
				.voiceEnabled(savedAiMsg.isVoiceEnabled())
				.grammarCorrection(savedAiMsg.getGrammarCorrection())
				.betterSentence(savedAiMsg.getBetterSentence())
				.vocabularySuggestions(savedAiMsg.getVocabularySuggestions())
				.explanation(savedAiMsg.getExplanation())
				.followUpQuestion(savedAiMsg.getFollowUpQuestion())
				.suggestedResponses(suggestedList)
				.bookmarked(false)
				.createdAt(savedAiMsg.getCreatedAt())
				.build();
	}

	@Override
	public void deleteSession(Long id) {
		User user = currentUser();
		ChatSession session = chatSessionRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Chat session not found"));

		if (!session.getUser().getId().equals(user.getId())) {
			throw new SecurityException("Unauthorized access to chat session");
		}

		chatSessionRepository.delete(session);
	}

	@Override
	public ChatSessionResponse renameSession(Long id, ChatRenameRequest request) {
		User user = currentUser();
		ChatSession session = chatSessionRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Chat session not found"));

		if (!session.getUser().getId().equals(user.getId())) {
			throw new SecurityException("Unauthorized access to chat session");
		}

		session.setTitle(request.getTitle());
		ChatSession saved = chatSessionRepository.save(session);

		return ChatSessionResponse.builder()
				.id(saved.getId())
				.mode(saved.getMode())
				.title(saved.getTitle())
				.messageCount(saved.getMessages().size())
				.createdAt(saved.getCreatedAt())
				.updatedAt(saved.getUpdatedAt())
				.build();
	}

	@Override
	public boolean toggleBookmark(Long messageId) {
		User user = currentUser();
		ChatMessage message = chatMessageRepository.findById(messageId)
				.orElseThrow(() -> new IllegalArgumentException("Chat message not found"));

		Optional<ChatBookmark> existing = chatBookmarkRepository.findByUserAndMessage(user, message);
		if (existing.isPresent()) {
			chatBookmarkRepository.delete(existing.get());
			return false; // Unbookmarked
		} else {
			ChatBookmark bookmark = ChatBookmark.builder()
					.user(user)
					.message(message)
					.build();
			chatBookmarkRepository.save(bookmark);
			return true; // Bookmarked
		}
	}

	@Override
	public List<ChatMessageResponse> getBookmarkedMessages() {
		User user = currentUser();
		return chatBookmarkRepository.findByUserOrderByCreatedAtDesc(user).stream()
				.map(b -> {
					ChatMessage m = b.getMessage();
					return ChatMessageResponse.builder()
							.id(m.getId())
							.sender(m.getSender())
							.message(m.getMessage())
							.voiceEnabled(m.isVoiceEnabled())
							.grammarCorrection(m.getGrammarCorrection())
							.betterSentence(m.getBetterSentence())
							.vocabularySuggestions(m.getVocabularySuggestions())
							.explanation(m.getExplanation())
							.followUpQuestion(m.getFollowUpQuestion())
							.bookmarked(true)
							.createdAt(m.getCreatedAt())
							.build();
				})
				.toList();
	}

	@Override
	public List<String> getHints(Long id) {
		ChatSession session = chatSessionRepository.findById(id)
				.orElseThrow(() -> new RuntimeException("Session not found"));

		List<ChatMessage> history = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session);

		String lastAiMsg = "";
		for (int i = history.size() - 1; i >= 0; i--) {
			if ("assistant".equalsIgnoreCase(history.get(i).getSender()) || "ai".equalsIgnoreCase(history.get(i).getSender())) {
				lastAiMsg = history.get(i).getMessage();
				break;
			}
		}

		// Build context for suggestions
		List<GroqRequest.Message> groqMessages = new ArrayList<>();
		String systemPrompt = String.format(
				"You are an expert English tutor observing a live practice chat in mode: '%s'.\n\n" +
				"LATEST TUTOR MESSAGE / QUESTION:\n\"%s\"\n\n" +
				"TASK:\n" +
				"Based on what the tutor just asked or said, provide EXACTLY 3 short, natural, and distinct alternative responses the student could say next.\n" +
				"1. Direct, realistic answer or reaction (5-10 words).\n" +
				"2. Natural personal experience or polite elaboration (6-12 words).\n" +
				"3. Thoughtful follow-up question or perspective (5-10 words).\n\n" +
				"CRITICAL RULES:\n" +
				"- Tailor each response directly to what the tutor said in the context of '%s'.\n" +
				"- NEVER write 'Suggestion 1' or labels. Each must be an authentic spoken sentence.\n" +
				"- YOU MUST RESPOND IN VALID JSON FORMAT ONLY. Do not wrap in ```json or markdown blocks.\n" +
				"{\n" +
				"  \"hints\": [\n" +
				"    \"First realistic response\",\n" +
				"    \"Second realistic response\",\n" +
				"    \"Third realistic response\"\n" +
				"  ]\n" +
				"}",
				session.getMode(),
				(lastAiMsg.isEmpty() ? "Hello! How can I help you practice today?" : lastAiMsg),
				session.getMode()
		);
		groqMessages.add(new GroqRequest.Message("system", systemPrompt));

		// Add last 10 messages for context
		int startIdx = Math.max(0, history.size() - 10);
		for (int i = startIdx; i < history.size(); i++) {
			ChatMessage m = history.get(i);
			String role = m.getSender().equals("user") ? "user" : "assistant";
			groqMessages.add(new GroqRequest.Message(role, m.getMessage()));
		}

		try {
			String rawReply = callGroqChat(groqMessages);
			String cleanJson = rawReply.trim();
			if (cleanJson.startsWith("```")) {
				cleanJson = cleanJson.substring(cleanJson.indexOf("\n") + 1);
			}
			if (cleanJson.endsWith("```")) {
				cleanJson = cleanJson.substring(0, cleanJson.lastIndexOf("```"));
			}
			cleanJson = cleanJson.trim();

			com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(cleanJson);
			if (node.has("hints")) {
				List<String> raw = objectMapper.convertValue(node.get("hints"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
				if (raw != null && !raw.isEmpty()) {
					List<String> cleanList = new ArrayList<>();
					for (String h : raw) {
						if (h != null) {
							String c = h.replaceAll("(?i)^(suggestion|option|hint|choice)\\s*\\d*\\s*[:\\-.]?\\s*", "")
										.replaceAll("^\\d+[\\.\\)]\\s*", "")
										.replaceAll("^[\"']+|[\"']+$", "").trim();
							if (!c.isEmpty() && !c.toLowerCase().startsWith("suggestion") && !cleanList.contains(c)) {
								cleanList.add(c);
							}
						}
					}
					if (cleanList.size() >= 2) return cleanList;
				}
			}
		} catch (Exception e) {
			// ignore and fallback
		}

		String modeName = (session.getMode() != null && !session.getMode().trim().isEmpty())
				? session.getMode().trim()
				: "our conversation";
		return List.of(
				"I'd love to share my perspective on " + modeName + ".",
				"In my experience, consistent speaking practice really helps.",
				"What do native speakers typically recommend in this situation?"
		);
	}

	// ── Helpers ───────────────────────────────────────────────────────

	private String callGroqChat(List<GroqRequest.Message> messages) {
		try {
			GroqRequest request = new GroqRequest(model, messages, 0.7);

			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.setBearerAuth(apiKey);

			HttpEntity<GroqRequest> entity = new HttpEntity<>(request, headers);
			ResponseEntity<GroqResponse> response = restTemplate.postForEntity(apiUrl, entity, GroqResponse.class);
			GroqResponse body = response.getBody();

			if (body == null || body.getChoices() == null || body.getChoices().isEmpty()) {
				throw new RuntimeException("No response received from Groq.");
			}

			return body.getChoices().get(0).getMessage().getContent();
		} catch (Exception e) {
			if (!"qwen/qwen3.6-27b".equals(model)) {
				try {
					GroqRequest request = new GroqRequest("qwen/qwen3.6-27b", messages, 0.7);
					HttpHeaders headers = new HttpHeaders();
					headers.setContentType(MediaType.APPLICATION_JSON);
					headers.setBearerAuth(apiKey);
					HttpEntity<GroqRequest> entity = new HttpEntity<>(request, headers);
					ResponseEntity<GroqResponse> response = restTemplate.postForEntity(apiUrl, entity, GroqResponse.class);
					GroqResponse body = response.getBody();
					if (body != null && body.getChoices() != null && !body.getChoices().isEmpty()) {
						return body.getChoices().get(0).getMessage().getContent();
					}
				} catch (Exception ignored) {}
			}
			throw new RuntimeException("Groq API Call failed: " + e.getMessage());
		}
	}

	private String extractTagContent(String text, String targetTag, String... nextTags) {
		int start = text.indexOf(targetTag);
		if (start == -1) return null;
		start += targetTag.length();

		int end = text.length();
		for (String nextTag : nextTags) {
			int idx = text.indexOf(nextTag, start);
			if (idx != -1 && idx < end) {
				end = idx;
			}
		}

		return text.substring(start, end).trim();
	}

	private String buildUserContextInstruction(User user, String modeName) {
		if (user == null) {
			return "Learner Profile: General English Learner.\nInstructions: Use friendly, clear English suited to everyday conversation.\n";
		}

		boolean isStudent = (user.getRole() == Role.STUDENT) || (user.getSchoolGrade() != null && !user.getSchoolGrade().trim().isEmpty());
		String grade = user.getSchoolGrade();
		String ageGroup = user.getAgeGroup();
		String mode = (modeName != null) ? modeName.trim() : "General English";
		boolean isBusinessMode = "Business English".equalsIgnoreCase(mode) || "Interview Coach".equalsIgnoreCase(mode);

		StringBuilder sb = new StringBuilder();

		if (isStudent && grade != null && !grade.trim().isEmpty()) {
			String g = grade.trim().toLowerCase();
			sb.append("Learner Profile: School Student (").append(grade).append(").\n");
			if (g.contains("1st") || g.contains("2nd") || g.contains("first") || g.contains("second")) {
				sb.append("School Standard: 1st/2nd Standard (Primary School, Age 6-7).\n")
				  .append("Instructions: Use extremely simple English (3-5 word sentences, Pre-A1/A1). Talk about colors, animals, pets, family, cartoon characters, shapes, and favorite toys. Be super cheerful, supportive, and use simple joyful words. NEVER talk about jobs, money, exams, or adult topics.\n");
			} else if (g.contains("3rd") || g.contains("4th") || g.contains("5th") || g.contains("third") || g.contains("fourth") || g.contains("fifth")) {
				sb.append("School Standard: 3rd-5th Standard (Upper Primary School, Age 8-10).\n")
				  .append("Instructions: Use basic, clear English (A1-A2). Talk about school subjects (Math, Science, Drawing), friends, playground games, hobbies, pets, food snacks, and fun stories. Keep sentences short and engaging. Never use corporate or adult themes.\n");
			} else if (g.contains("6th") || g.contains("7th") || g.contains("8th") || g.contains("sixth") || g.contains("seventh") || g.contains("eighth")) {
				sb.append("School Standard: 6th-8th Standard (Middle School, Age 11-13).\n")
				  .append("Instructions: Use friendly, encouraging English (A2-B1). Talk about school projects, science experiments, sports, games, coding, history, environment, and books. Ask curious questions that help students share their own thoughts.\n");
			} else { // 9th, 10th Standard or High School
				sb.append("School Standard: 9th-10th Standard (High School / Board Exam, Age 14-16).\n")
				  .append("Instructions: Use structured, natural conversational English (B1-B2). Talk about board exams, career dreams, technology, space science, social topics, debating ideas, hobbies, and public speaking. Encourage fluent sentence structures and rich vocabulary.\n");
			}
		} else {
			// Individual User Profile by Age Group
			sb.append("Learner Profile: Individual User.\n");
			if ("Kids".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Kids (Age 6-12).\n")
				  .append("Instructions: Be super enthusiastic and friendly. Talk about animals, stories, games, toys, and school. Use simple words and short sentences (A1). Zero adult or corporate themes.\n");
			} else if ("Teens".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Teens (Age 13-17).\n")
				  .append("Instructions: Be a supportive peer tutor. Use modern, relatable conversational English (A2-B1). Talk about school life, friends, music, sports, gaming, and teen hobbies.\n");
			} else if ("Young Adult".equalsIgnoreCase(ageGroup) || "Young Adults".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Young Adults (Age 18-24).\n")
				  .append("Instructions: Use energetic, natural conversational English (B1-B2). Talk about college campus, travel, movies, technology, social confidence, and career aspirations.\n");
			} else if ("Senior".equalsIgnoreCase(ageGroup) || "Seniors".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Seniors (Age 50+).\n")
				  .append("Instructions: Be warm, patient, and respectful. Talk about culture, history, books, gardening, travel, health, and life experiences.\n");
			} else { // Professional / Working Adult (25-50) or default
				sb.append("Age Group: Adults (Age 25-50).\n");
				if (isBusinessMode) {
					sb.append("Instructions: Focus on Business English, corporate meeting scenarios, presentations, formal tone, and professional workplace communication.\n");
				} else {
					sb.append("Instructions: Talk naturally as a friendly adult peer about daily life, cooking, fitness, weekend plans, hobbies, books, travel, and personal interests. STRICT RULE: DO NOT steer the conversation into corporate meetings, office projects, or business jargon unless the student explicitly asks.\n");
				}
			}
		}

		if (!isBusinessMode) {
			sb.append("TOPIC GUARDRAIL: The active scenario/mode is '").append(mode).append("'. Stick strictly to this scenario. Do NOT turn conversations into business, office, or corporate meetings unless the user explicitly requests it.\n");
		}

		return sb.toString();
	}

	private List<String> generateContextualFallbacks(String mode, String reply, String followup) {
		String m = mode != null ? mode.toLowerCase() : "";
		String context = ((reply != null ? reply : "") + " " + (followup != null ? followup : "")).toLowerCase();

		if (context.contains("name") || context.contains("who are you") || context.contains("introduce")) {
			return List.of(
					"Hi! Nice to meet you. I'm excited to practice!",
					"Hello! I want to improve my speaking confidence.",
					"Could you introduce yourself as well?"
			);
		}
		if (m.contains("travel") || context.contains("flight") || context.contains("hotel") || context.contains("trip")) {
			return List.of(
					"Could you recommend the best places to visit?",
					"I would like to book a reservation, please.",
					"How do I get to the city center from here?"
			);
		}
		if (m.contains("interview") || context.contains("job") || context.contains("career") || context.contains("experience")) {
			return List.of(
					"I have strong problem-solving and communication skills.",
					"I'm eager to take on new challenges and learn.",
					"Could you give me feedback on my response?"
			);
		}
		if (m.contains("business") || context.contains("meeting") || context.contains("project")) {
			return List.of(
					"Let's review the primary action items for this project.",
					"I agree with that strategy and propose we move forward.",
					"Could you share your perspective on this proposal?"
			);
		}
		if (m.contains("grammar") || context.contains("rule") || context.contains("tense")) {
			return List.of(
					"Could you explain the difference between these two tenses?",
					"Is there a more natural way to phrase this?",
					"Can we practice with another example sentence?"
			);
		}
		if (m.contains("vocabulary") || context.contains("idiom") || context.contains("synonym")) {
			return List.of(
					"What are common native synonyms for this word?",
					"Could you teach me a natural idiom for this situation?",
					"Let's practice using these new words in sentences."
			);
		}
		if (m.contains("ielts")) {
			return List.of(
					"In my opinion, there are several key benefits to consider.",
					"From my personal experience, consistent effort is essential.",
					"Could you evaluate my answer based on IELTS scoring?"
			);
		}
		return List.of(
				"That makes total sense! Could you tell me more?",
				"I understand. What do you recommend I focus on next?",
				"Could you give me an example of how a native would say that?"
		);
	}

	@Override
	public ChatSessionFinishResponse finishSession(Long id) {
		User user = currentUser();
		ChatSession session = chatSessionRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Chat session not found"));

		if (!session.getUser().getId().equals(user.getId())) {
			throw new SecurityException("Unauthorized access to chat session");
		}

		List<ChatMessage> messages = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session);
		List<ChatMessage> userMessages = messages.stream()
				.filter(m -> "user".equalsIgnoreCase(m.getSender()))
				.toList();

		int userMessageCount = userMessages.size();
		int totalWords = 0;
		for (ChatMessage m : userMessages) {
			if (m.getMessage() != null && !m.getMessage().trim().isEmpty()) {
				totalWords += m.getMessage().trim().split("\\s+").length;
			}
		}

		// Calculate practice duration in seconds
		long durationSeconds = 60;
		if (!messages.isEmpty()) {
			LocalDateTime first = messages.get(0).getCreatedAt();
			LocalDateTime last = messages.get(messages.size() - 1).getCreatedAt();
			if (first != null && last != null) {
				durationSeconds = Math.max(30, java.time.Duration.between(first, last).getSeconds());
			}
		}

		// Genuine chatting criteria: At least 3 user turns AND at least 15 words spoken/typed
		boolean isEligible = userMessageCount >= 3 && totalWords >= 15;
		int xpEarned = isEligible ? 5 : 0;

		if (isEligible) {
			try {
				Progress progress = progressRepository.findByUser(user)
						.orElseGet(() -> Progress.builder()
								.user(user)
								.xp(0)
								.level(1)
								.currentStreak(0)
								.longestStreak(0)
								.totalPracticeMinutes(0)
								.totalSpeakingSessions(0)
								.totalGrammarChecks(0)
								.totalVocabularyWords(0)
								.build());

				int newXp = (progress.getXp() == null ? 0 : progress.getXp()) + xpEarned;
				progress.setXp(newXp);
				progress.setLevel(Math.max(1, (newXp / 500) + 1));

				int sessionMinutes = (int) Math.max(1, Math.ceil(durationSeconds / 60.0));
				progress.setTotalPracticeMinutes((progress.getTotalPracticeMinutes() == null ? 0 : progress.getTotalPracticeMinutes()) + sessionMinutes);
				progressRepository.save(progress);
			} catch (Exception ignored) {}
		}

		String feedback;
		if (isEligible) {
			feedback = "Great chat session! You completed " + userMessageCount + " exchanges (" + totalWords + " words) and earned 5 XP! Keep up the great work!";
		} else {
			feedback = "Session ended with " + userMessageCount + " exchange(s). Chat at least 3 turns (15+ words) next time to earn 5 XP! Keep practicing!";
		}

		return ChatSessionFinishResponse.builder()
				.sessionId(session.getId())
				.mode(session.getMode())
				.title(session.getTitle())
				.userMessageCount(userMessageCount)
				.totalWords(totalWords)
				.xpEarned(xpEarned)
				.feedback(feedback)
				.eligibleForXp(isEligible)
				.build();
	}
}
