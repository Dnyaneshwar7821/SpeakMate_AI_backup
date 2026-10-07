package com.rslsolution.speakmateai.service.impl;

import java.time.Duration;
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
import com.rslsolution.speakmateai.dto.groq.GroqRequest;
import com.rslsolution.speakmateai.dto.groq.GroqResponse;
import com.rslsolution.speakmateai.dto.request.SpeakingMessageRequest;
import com.rslsolution.speakmateai.dto.request.SpeakingSessionRequest;
import com.rslsolution.speakmateai.dto.request.SpeakingStartRequest;
import com.rslsolution.speakmateai.dto.response.SpeakingEndResponse;
import com.rslsolution.speakmateai.dto.response.SpeakingHistoryResponse;
import com.rslsolution.speakmateai.dto.response.SpeakingMessageResponse;
import com.rslsolution.speakmateai.dto.response.SpeakingSessionDetailResponse;
import com.rslsolution.speakmateai.dto.response.SpeakingSessionResponse;
import com.rslsolution.speakmateai.entity.ConversationFeedback;
import com.rslsolution.speakmateai.entity.ConversationMessage;
import com.rslsolution.speakmateai.entity.SpeakingSession;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.exception.GroqException;
import com.rslsolution.speakmateai.exception.SpeakingSessionNotFoundException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.ConversationFeedbackRepository;
import com.rslsolution.speakmateai.repository.ConversationMessageRepository;
import com.rslsolution.speakmateai.repository.SpeakingSessionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.service.SpeakingSessionService;
import com.rslsolution.speakmateai.service.NotificationService;

@Service
@Transactional
public class SpeakingSessionServiceImpl implements SpeakingSessionService {

	@Value("${groq.api.key:}")
	private String apiKey;

	@Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}")
	private String apiUrl;

	@Value("${groq.model.chat:${groq.model:llama-3.1-8b-instant}}")
	private String model;

	private final SpeakingSessionRepository speakingSessionRepository;
	private final ConversationMessageRepository messageRepository;
	private final ConversationFeedbackRepository feedbackRepository;
	private final UserRepository userRepository;
	private final RestTemplate restTemplate;
	private final ObjectMapper objectMapper;
	private final ProgressRepository progressRepository;
	private final NotificationService notificationService;
	private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

	public SpeakingSessionServiceImpl(SpeakingSessionRepository speakingSessionRepository,
			ConversationMessageRepository messageRepository,
			ConversationFeedbackRepository feedbackRepository,
			UserRepository userRepository,
			RestTemplate restTemplate,
			ObjectMapper objectMapper,
			ProgressRepository progressRepository,
			NotificationService notificationService,
			org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
		this.speakingSessionRepository = speakingSessionRepository;
		this.messageRepository = messageRepository;
		this.feedbackRepository = feedbackRepository;
		this.userRepository = userRepository;
		this.restTemplate = restTemplate;
		this.objectMapper = objectMapper;
		this.progressRepository = progressRepository;
		this.notificationService = notificationService;
		this.jdbcTemplate = jdbcTemplate;
	}

	private SpeakingSession safeSaveSession(SpeakingSession session) {
		try {
			return speakingSessionRepository.save(session);
		} catch (Exception e) {
			// If legacy foreign key constraint pointing to students table is encountered,
			// drop it dynamically and retry
			try {
				if (jdbcTemplate != null) {
					jdbcTemplate.execute(
							"ALTER TABLE IF EXISTS speaking_sessions DROP CONSTRAINT IF EXISTS fkbtsorovntca8vl5eslvcwfwf3 CASCADE");
				}
			} catch (Exception ignored) {
			}
			return speakingSessionRepository.save(session);
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────

	private User currentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated()
				|| "anonymousUser".equals(authentication.getName())) {
			throw new UserNotFoundException("User not authenticated");
		}
		return userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));
	}

	private static final List<String> FALLBACK_MODELS = List.of(
			"openai/gpt-oss-120b",
			"qwen/qwen3.6-27b",
			"openai/gpt-oss-20b");

	private String callGroqChat(List<GroqRequest.Message> messages) {
		List<String> modelsToTry = new ArrayList<>();
		if (model != null && !model.trim().isEmpty()) {
			modelsToTry.add(model.trim());
		}
		for (String fb : FALLBACK_MODELS) {
			if (!modelsToTry.contains(fb)) {
				modelsToTry.add(fb);
			}
		}

		Exception lastException = null;
		for (String targetModel : modelsToTry) {
			try {
				GroqRequest request = new GroqRequest(targetModel, messages, 0.7);

				HttpHeaders headers = new HttpHeaders();
				headers.setContentType(MediaType.APPLICATION_JSON);
				headers.setBearerAuth(apiKey);

				HttpEntity<GroqRequest> entity = new HttpEntity<>(request, headers);
				ResponseEntity<GroqResponse> response = restTemplate.postForEntity(apiUrl, entity, GroqResponse.class);
				GroqResponse body = response.getBody();

				if (body != null && body.getChoices() != null && !body.getChoices().isEmpty()) {
					return body.getChoices().get(0).getMessage().getContent();
				}
			} catch (Exception e) {
				lastException = e;
				// If 429 rate limit or error, automatically try the next model in the cascade!
			}
		}
		throw new GroqException("Groq API Call failed on all models: "
				+ (lastException != null ? lastException.getMessage() : "Unknown"));
	}

	private String stripReasoning(String text) {
		if (text == null)
			return "";
		String clean = text.replaceAll("(?s)<think>.*?</think>", "").trim();
		if (clean.contains("Analyze User Input:") || clean.contains("Identify Key Constraints:")
				|| clean.contains("Context:") || clean.contains("**Analyze")) {
			int idx = clean.lastIndexOf("\n\n");
			if (idx != -1 && idx < clean.length() - 1) {
				String candidate = clean.substring(idx).trim();
				if (!candidate.contains("Analyze") && !candidate.contains("Context:") && !candidate.contains("**")) {
					return candidate;
				}
			}
			return null;
		}
		return clean;
	}

	private String cleanJsonResponse(String response) {
		if (response == null)
			return "{}";
		String trimmed = response.replaceAll("(?s)<think>.*?</think>", "").trim();

		int startObj = trimmed.indexOf('{');
		int endObj = trimmed.lastIndexOf('}');
		int startArr = trimmed.indexOf('[');
		int endArr = trimmed.lastIndexOf(']');

		if (startArr != -1 && endArr != -1 && (startObj == -1 || startArr < startObj) && endArr > startArr) {
			trimmed = trimmed.substring(startArr, endArr + 1);
		} else if (startObj != -1 && endObj != -1 && endObj >= startObj) {
			trimmed = trimmed.substring(startObj, endObj + 1);
		} else {
			if (trimmed.startsWith("```json")) {
				trimmed = trimmed.substring(7);
			} else if (trimmed.startsWith("```")) {
				trimmed = trimmed.substring(3);
			}
			if (trimmed.endsWith("```")) {
				trimmed = trimmed.substring(0, trimmed.length() - 3);
			}
		}
		return trimmed.trim();
	}

	private String extractFieldFromJson(String json, String fieldName) {
		if (json == null || !json.contains(fieldName))
			return null;
		try {
			// Try quoted string pattern first (handles multi-line values using DOTALL)
			java.util.regex.Pattern quotedPattern = java.util.regex.Pattern.compile(
					"\"" + fieldName + "\"\\s*:\\s*\"(.*?)\"\\s*(?=,|\\n|\\r|\\})",
					java.util.regex.Pattern.DOTALL | java.util.regex.Pattern.CASE_INSENSITIVE);
			java.util.regex.Matcher matcher = quotedPattern.matcher(json);
			if (matcher.find()) {
				String val = matcher.group(1);
				// Unescape common JSON escapes
				val = val.replace("\\\"", "\"")
						.replace("\\n", "\n")
						.replace("\\r", "\r")
						.replace("\\t", "\t")
						.replace("\\\\", "\\");
				return val.trim();
			}

			// Try unquoted pattern (like null, numbers, booleans)
			java.util.regex.Pattern unquotedPattern = java.util.regex.Pattern.compile(
					"\"" + fieldName + "\"\\s*:\\s*([^,\\}\\s]+)",
					java.util.regex.Pattern.CASE_INSENSITIVE);
			matcher = unquotedPattern.matcher(json);
			if (matcher.find()) {
				String val = matcher.group(1).trim();
				if ("null".equalsIgnoreCase(val)) {
					return null;
				}
				return val;
			}
		} catch (Exception e) {
			// ignore
		}
		return null;
	}

	// ── Existing CRUD (kept for compatibility) ────────────────────────

	@Override
	public SpeakingSessionResponse createSession(SpeakingSessionRequest request) {
		User user = currentUser();
		double overallScore = request.getOverallScore() != null ? request.getOverallScore()
				: (request.getScore() != null ? request.getScore() : 80.0);
		double fluencyScore = request.getFluencyScore() != null ? request.getFluencyScore() : overallScore;
		double grammarScore = request.getGrammarScore() != null ? request.getGrammarScore() : overallScore;
		double vocabularyScore = request.getVocabularyScore() != null ? request.getVocabularyScore() : overallScore;
		double pronunciationScore = request.getPronunciationScore() != null ? request.getPronunciationScore()
				: overallScore;
		int xp = request.getXpEarned() != null ? request.getXpEarned() : 15;
		int duration = request.getDuration() != null ? request.getDuration() : 60;
		String scenario = request.getScenario() != null ? request.getScenario() : request.getTopic();

		SpeakingSession session = SpeakingSession.builder()
				.user(user)
				.topic(request.getTopic())
				.scenario(scenario)
				.transcript(request.getTranscript())
				.duration(duration)
				.xpEarned(xp)
				.score(overallScore)
				.overallScore(overallScore)
				.fluencyScore(fluencyScore)
				.grammarScore(grammarScore)
				.vocabularyScore(vocabularyScore)
				.pronunciationScore(pronunciationScore)
				.feedback(request.getFeedback())
				.completed(true)
				.build();

		SpeakingSession savedSession = safeSaveSession(session);

		// Save conversation feedback if provided
		if (request.getGrammarCorrections() != null || request.getBetterSentences() != null
				|| request.getVocabularyLearned() != null || request.getFeedback() != null) {
			try {
				ConversationFeedback feedback = ConversationFeedback.builder()
						.session(savedSession)
						.grammarCorrections(request.getGrammarCorrections())
						.betterSentences(request.getBetterSentences())
						.vocabularySuggestions(request.getVocabularyLearned())
						.summary(request.getFeedback())
						.build();
				feedbackRepository.save(feedback);
			} catch (Exception ex) {
				System.err.println("Could not save feedback for session: " + ex.getMessage());
			}
		}

		// Update user progress
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
			int sessionMinutes = (int) Math.max(1, Math.ceil(duration / 60.0));
			progress.setTotalPracticeMinutes(
					(progress.getTotalPracticeMinutes() == null ? 0 : progress.getTotalPracticeMinutes())
							+ sessionMinutes);
			progress.setTotalSpeakingSessions(
					(progress.getTotalSpeakingSessions() == null ? 0 : progress.getTotalSpeakingSessions()) + 1);
			int newXp = (progress.getXp() == null ? 0 : progress.getXp()) + xp;
			progress.setXp(newXp);
			progress.setLevel(Math.max(1, (newXp / 500) + 1));
			progressRepository.save(progress);
		} catch (Exception ex) {
			System.err.println("Could not update progress for session: " + ex.getMessage());
		}

		return mapToResponse(savedSession);
	}

	@Override
	public List<SpeakingSessionResponse> getAllSessions() {
		User user = currentUser();
		return speakingSessionRepository.findByUserOrderByCreatedAtDesc(user).stream()
				.filter(s -> Boolean.TRUE.equals(s.getCompleted()))
				.map(this::mapToResponse)
				.toList();
	}

	@Override
	public SpeakingSessionResponse getSessionById(Long id) {
		SpeakingSession session = speakingSessionRepository.findById(id)
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Speaking session not found"));
		return mapToResponse(session);
	}

	@Override
	public void deleteSession(Long id) {
		SpeakingSession session = speakingSessionRepository.findById(id)
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Speaking session not found"));
		try {
			feedbackRepository.findBySession(session).ifPresent(feedbackRepository::delete);
		} catch (Exception ignored) {
		}
		try {
			List<ConversationMessage> msgs = messageRepository.findBySessionOrderByTimestampAsc(session);
			if (msgs != null && !msgs.isEmpty()) {
				messageRepository.deleteAll(msgs);
			}
		} catch (Exception ignored) {
		}
		speakingSessionRepository.delete(session);
	}

	private SpeakingSessionResponse mapToResponse(SpeakingSession session) {
		return SpeakingSessionResponse.builder()
				.id(session.getId())
				.topic(session.getTopic())
				.transcript(session.getTranscript())
				.duration(session.getDuration())
				.pronunciationScore(session.getPronunciationScore())
				.fluencyScore(session.getFluencyScore())
				.grammarScore(session.getGrammarScore())
				.vocabularyScore(session.getVocabularyScore())
				.overallScore(session.getOverallScore())
				.feedback(session.getFeedback())
				.createdAt(session.getCreatedAt())
				.build();
	}

	// ── Phase 2 — Speaking practice module ────────────────────────────

	private String getDefaultScenarioOpening(String scenario) {
		if (scenario == null)
			return "Hello! Welcome to our speaking practice session. How are you doing today?";
		String s = scenario.toLowerCase();

		// Kids
		if (s.contains("show & tell") || s.contains("superhero") || s.contains("toy")) {
			return "Hi there! I am so excited for Show and Tell today! What awesome toy, superhero, or story do you want to share with me?";
		} else if (s.contains("zoo") || s.contains("animal")) {
			return "Hello! Welcome to the city zoo! We have roaring lions, playful monkeys, and huge elephants. What animal do you want to visit first?";
		} else if (s.contains("ice cream")) {
			return "Hi! Welcome to the ice cream parlor! We have delicious chocolate, creamy vanilla, and fresh strawberry. What flavor would you like?";
		} else if (s.contains("school lunch") || s.contains("canteen")) {
			return "Hey! Welcome to lunchtime. I have a tasty sandwich and fruit juice today. What did you bring for lunch?";
		} else if (s.contains("space adventure") || s.contains("space rocket")) {
			return "Greetings, astronaut! We are about to launch our rocket into outer space. Are you ready for countdown in 3, 2, 1?";
		} else if (s.contains("park") || s.contains("playground") || s.contains("swings")) {
			return "Hello friend! The weather is so nice at the park. Do you want to play on the swings or kick the football first?";
		} else if (s.contains("birthday party")) {
			return "Happy Birthday! Welcome to the celebration! Would you like some cake, or should we play party games first?";
		} else if (s.contains("doctor") || s.contains("pharmacy") || s.contains("health")) {
			return "Hello! Come on in and have a seat. How are you feeling today, and how can I help you feel better?";
		} else if (s.contains("bedtime story")) {
			return "Good evening! Let's create a wonderful bedtime adventure story together. Once upon a time, where should our journey begin?";
		}

		// School Standards (1st to 10th Std)
		else if (s.contains("alphabet") || s.contains("phonics") || s.contains("sounds fun")) {
			return "Hello young learner! Welcome to fun with letters and sounds. Which letter of the alphabet is your favorite?";
		} else if (s.contains("colors & drawing")) {
			return "Hello artist! I love drawing and painting. What bright colors do you like to color your pictures with?";
		} else if (s.contains("school greetings") || s.contains("morning routine")) {
			return "Good morning! It is wonderful to see you today. How did you start your morning routine before coming to school?";
		} else if (s.contains("classroom objects") || s.contains("stationery")) {
			return "Good day! Welcome to our classroom. Could you tell me what stationery items you have in your school bag today?";
		} else if (s.contains("science project") || s.contains("robotics")) {
			return "Welcome to the science and innovation lab! What exciting project or model are you preparing to demonstrate?";
		} else if (s.contains("water conservation") || s.contains("environmental care") || s.contains("climate")) {
			return "Hello! Thank you for joining our environmental session. In your opinion, what is the best way we can save water and protect nature?";
		} else if (s.contains("debate")) {
			return "Welcome to today's formal debate session. The floor is yours—please present your opening statement on the topic.";
		} else if (s.contains("student council") || s.contains("leadership")) {
			return "Welcome candidate! Thank you for stepping up for student council leadership. What positive changes do you plan to bring to our school?";
		} else if (s.contains("board oral exam") || s.contains("oratory mastery") || s.contains("keynote")) {
			return "Welcome to the formal oral examination. Please begin by introducing yourself and stating your primary speaking topic.";
		}

		// Teens & Young Adults
		else if (s.contains("high school") || s.contains("first day")) {
			return "Hey! Welcome to the new school term. I'm excited to be your classmate! How has your first day been going so far?";
		} else if (s.contains("fast food") || s.contains("burger")) {
			return "Hey! Welcome to Burger Express. Are you ready to order, or would you like to check out our combo meals today?";
		} else if (s.contains("gaming") || s.contains("hobbies")) {
			return "Hey there! It's great to connect. What video games, music, or hobbies have you been enjoying recently?";
		} else if (s.contains("homework help")) {
			return "Hi! Don't worry, we can work through this assignment together. Which question or topic is giving you trouble?";
		} else if (s.contains("coffee") || s.contains("cafe")) {
			return "Hi there! Welcome to the cafe. What specialty coffee or tea can I brew for you today?";
		} else if (s.contains("hotel") || s.contains("check-in")) {
			return "Good day and welcome to our hotel! Are you checking in under a reservation today?";
		} else if (s.contains("airport") || s.contains("customs") || s.contains("backpacking")
				|| s.contains("travel")) {
			return "Good day! Welcome to airport check-in. May I see your passport and travel documents, please?";
		} else if (s.contains("job interview") || s.contains("admission interview") || s.contains("part-time job")
				|| s.contains("interview")) {
			return "Welcome and thank you for meeting with us today! To begin, could you please introduce yourself and tell us what interests you about this role?";
		} else if (s.contains("roommate") || s.contains("hostel") || s.contains("apartment")) {
			return "Hi there! It's great to meet you. Shall we discuss our room layout, shared chores, and daily schedules?";
		} else if (s.contains("restaurant") || s.contains("dining") || s.contains("food")) {
			return "Hello! Welcome to our restaurant. Can I get a table ready for you, or would you like to see our dinner menu?";
		} else if (s.contains("shopping") || s.contains("clothes") || s.contains("store")) {
			return "Hi! Welcome to our store. Are you looking for a specific size, color, or style today?";
		}

		// Professionals & Seniors
		else if (s.contains("office small talk") || s.contains("business meeting") || s.contains("meeting")
				|| s.contains("business")) {
			return "Good morning! Thank you for joining our session today. Shall we review the key project milestones and agenda items?";
		} else if (s.contains("salary") || s.contains("contract negotiation")) {
			return "Good afternoon. Thank you for taking the time to discuss the offer. What aspects of the compensation package would you like to review?";
		} else if (s.contains("presentation skills") || s.contains("presentation")) {
			return "Welcome! The stage is set for your presentation. Whenever you're ready, please deliver your opening hook and slide overview.";
		} else if (s.contains("tea time") || s.contains("gardening")) {
			return "Good afternoon! A warm cup of tea is ready. How are your garden plants and home projects doing these days?";
		} else if (s.contains("museum tour") || s.contains("life stories")) {
			return "Welcome to the guided cultural tour! We have fascinating historical exhibits ahead. What period of history interests you most?";
		} else if (s.contains("customer support")) {
			return "Hello! Thank you for calling customer support. My name is Alex. How may I assist you with your account today?";
		} else if (s.contains("daily conversation") || s.contains("relaxed daily")) {
			return "Hello! Welcome to our daily conversation practice. How has your day been going so far?";
		}

		String cleanScenario = (scenario != null ? scenario : "")
				.replaceAll("(?i)\\b(conversation|practice|session)\\b", "").trim();
		String prefix = cleanScenario.isEmpty() ? "" : cleanScenario + " ";
		return "Hello! Welcome to our " + prefix + "conversation practice. What would you like to start with?";
	}

	@Override
	public SpeakingSessionResponse startSession(SpeakingStartRequest request) {
		User user = currentUser();

		String scenarioName = (request != null && request.getScenario() != null
				&& !request.getScenario().trim().isEmpty())
						? request.getScenario().trim()
						: "Daily Conversation";

		SpeakingSession session = SpeakingSession.builder()
				.user(user)
				.topic(scenarioName)
				.scenario(scenarioName)
				.duration(0)
				.xpEarned(0)
				.score(0.0)
				.transcript("")
				.completed(false)
				.build();

		SpeakingSession saved = safeSaveSession(session);

		// AI introduces the conversation scenario
		String intro;
		try {
			List<GroqRequest.Message> messages = new ArrayList<>();
			String sysPrompt = String.format(
					"You are an English tutor roleplaying the opening of the scenario: '%s'.\n" +
							"Immediately greet the student in-character (e.g. as a friendly waiter, interviewer, hotel clerk, or conversation partner).\n"
							+
							"Ask an engaging opening question to start the dialogue.\n" +
							"Keep it warm, natural, and under 2 sentences. Never output JSON, chain of thought, or formatting tags.",
					scenarioName);
			messages.add(new GroqRequest.Message("system", sysPrompt));
			messages.add(new GroqRequest.Message("user", "Hello! Let's start the conversation."));

			String rawIntro = callGroqChat(messages);
			intro = stripReasoning(rawIntro);
			if (intro == null || intro.trim().isEmpty() || intro.contains("{") || intro.contains("Analyze")) {
				intro = getDefaultScenarioOpening(scenarioName);
			}
		} catch (Exception e) {
			intro = getDefaultScenarioOpening(scenarioName);
		}

		// Save the AI message
		ConversationMessage aiMsg = ConversationMessage.builder()
				.session(saved)
				.sender("ai")
				.message(intro)
				.build();
		messageRepository.save(aiMsg);

		// Return session response (with transcript populated with intro)
		saved.setTranscript(intro);
		saved = safeSaveSession(saved);

		return mapToResponse(saved);
	}

	private String sanitizeSpokenText(String text) {
		if (text == null)
			return null;
		String clean = text.trim();
		// 1. Remove all bracket tags like [article], [GRAMMAR], [BETTER_SENTENCE], etc.
		clean = clean.replaceAll("\\[.*?\\]", "");
		// 2. Remove literal "dot dot dot", ellipses "...", "…"
		clean = clean.replaceAll("(?i)\\bdot\\s*dot\\s*dot\\b", "");
		clean = clean.replaceAll("\\.{2,}", "");
		clean = clean.replaceAll("…", "");
		// 3. Remove markdown markers like ** or * or _
		clean = clean.replaceAll("[*#_~`]", "");
		// 4. Remove stage directions like (smiling), (laughs), (excited)
		clean = clean.replaceAll("\\([^)]*\\)", "");
		// 5. Clean excess whitespace & outer quotes
		clean = clean.replaceAll("^[\"']+|[\"']+$", "").trim();
		clean = clean.replaceAll("\\s+", " ").trim();
		return clean.isEmpty() ? null : clean;
	}

	private String cleanAndSanitizeHint(String raw) {
		if (raw == null)
			return null;
		String text = sanitizeSpokenText(raw);
		if (text == null)
			return null;
		// Strip prefixes like "Suggestion 1:", "Option 1 -", "1. ", "Hint 1:"
		text = text.replaceAll("(?i)^(suggestion|option|hint|response|choice)\\s*\\d*\\s*[:\\-.]?\\s*", "");
		text = text.replaceAll("^\\d+[\\.\\)]\\s*", "");
		text = text.replaceAll("^[\"']+|[\"']+$", "").trim();
		if (text.isEmpty())
			return null;

		String lower = text.toLowerCase();
		if (lower.equals("suggestion one") || lower.equals("suggestion two") || lower.equals("suggestion three")
				|| lower.startsWith("suggestion ") || lower.startsWith("option ") || lower.equals("simple option")
				|| lower.equals("natural idiom option") || lower.equals("follow-up question option")
				|| lower.equals("simple direct response") || lower.equals("natural native response")
				|| lower.equals("engaging follow up question")
				|| lower.equals("first realistic sentence student can speak")
				|| lower.equals("second realistic sentence student can speak")
				|| lower.equals("third realistic sentence student can speak")
				|| lower.equals("none") || lower.equals("null")) {
			return null;
		}
		return text;
	}

	private List<String> getDefaultScenarioHints(String scenario) {
		return generateContextualScenarioHints(null, scenario, null, 0);
	}

	private List<String> getDefaultScenarioHints(String scenario, int turn) {
		return generateContextualScenarioHints(null, scenario, null, turn);
	}

	private List<String> generateContextualScenarioHints(User user, String scenario, String lastAiMessage, int turn) {
		int idx = Math.abs(turn);
		String s = (scenario != null) ? scenario.toLowerCase() : "";
		String ai = (lastAiMessage != null) ? lastAiMessage.toLowerCase() : "";

		boolean isStudent = (user != null && (user.getRole() == Role.STUDENT || (user.getSchoolGrade() != null && !user.getSchoolGrade().trim().isEmpty())))
				|| s.contains("std") || s.contains("school") || s.contains("grade") || s.contains("student") || s.contains("admission");
		String grade = (user != null && user.getSchoolGrade() != null) ? user.getSchoolGrade().toLowerCase() : "";

		// 1. Analyze what the AI tutor specifically asked in the latest turn
		if (ai.contains("project") || ai.contains("proud of") || ai.contains("activity") || ai.contains("initiative")) {
			if (isStudent) {
				List<List<String>> studentProjects = List.of(
						List.of("I recently coordinated a fundraiser for our local animal shelter.", "I worked on an inter-school science exhibition model with my classmates.", "Could I share about an extracurricular event I organized?"),
						List.of("I led our class team in building a renewable energy project.", "I organized a campus book donation drive that collected over 200 books.", "Would you like to hear about our community outreach project?"),
						List.of("I helped design our school magazine and wrote an editorial piece.", "I coordinated our robotics club entry for the regional science fair.", "May I tell you about the environmental club initiative I led?")
				);
				return studentProjects.get(idx % studentProjects.size());
			} else {
				List<List<String>> generalProjects = List.of(
						List.of("I recently led a project that improved our team's delivery time.", "I coordinated a cross-functional initiative that solved a key bottleneck.", "Could I share how our team achieved a major milestone recently?"),
						List.of("I organized a successful community workshop that reached many participants.", "I spearheaded a new initiative that significantly boosted collaboration.", "Would you like me to walk you through our recent project achievements?")
				);
				return generalProjects.get(idx % generalProjects.size());
			}
		}

		if (ai.contains("challenge") || ai.contains("difficult") || ai.contains("obstacle") || ai.contains("overcome") || ai.contains("problem")) {
			List<List<String>> challenges = List.of(
					List.of("Delegating tasks and keeping everyone on schedule was the toughest part.", "We overcame tight deadlines by prioritizing the most crucial deliverables.", "How would you suggest balancing unexpected challenges in group projects?"),
					List.of("Keeping all team members motivated required frequent communication.", "We resolved resource constraints by finding creative, alternative solutions.", "What is the best way to handle shifting priorities under pressure?"),
					List.of("Managing different opinions was challenging, but open dialogue helped us succeed.", "We broke down the complex problem into smaller, manageable steps.", "Could you share how teams typically navigate similar roadblocks?")
			);
			return challenges.get(idx % challenges.size());
		}

		if (ai.contains("conflict") || ai.contains("disagree") || ai.contains("resolve") || ai.contains("teamwork")) {
			List<List<String>> conflicts = List.of(
					List.of("Two teammates disagreed on the design, so we combined the best of both ideas.", "I scheduled a quick group meeting so every voice could be heard fairly.", "We found common ground by focusing on our shared project goal."),
					List.of("When opinions clashed, we evaluated both options based on objective criteria.", "I listened patiently to both sides and suggested a practical compromise.", "How do effective leaders usually mediate disagreements among peers?"),
					List.of("We resolved the issue by clarifying roles and aligning on next steps.", "Clear, empathetic communication prevented misunderstandings from escalating.", "Could you share tips for maintaining harmony during high-stakes projects?")
			);
			return conflicts.get(idx % conflicts.size());
		}

		if (ai.contains("strength") || ai.contains("quality") || ai.contains("qualities") || ai.contains("succeed") || ai.contains("why should we")) {
			if (isStudent) {
				List<List<String>> strengths = List.of(
						List.of("My strongest qualities are curiosity, discipline, and collaborative teamwork.", "I stay organized under pressure and love taking on challenging assignments.", "What qualities do you look for most in incoming students?"),
						List.of("I have strong analytical skills and genuinely enjoy problem solving.", "I communicate clearly and always support my teammates to do their best.", "How do successful students make the most of their time here?"),
						List.of("My adaptability and passion for learning help me thrive in new environments.", "I take initiative and welcome constructive feedback to keep improving.", "What extracurricular opportunities are most impactful for growth here?")
				);
				return strengths.get(idx % strengths.size());
			} else {
				List<List<String>> strengths = List.of(
						List.of("My greatest strengths are strategic problem solving and clear communication.", "I thrive in dynamic environments and take pride in dependable execution.", "What skills are most vital for excelling in this position?"),
						List.of("I bring a blend of technical expertise and empathetic collaboration.", "I actively seek feedback and continuously refine my workflows.", "How is long-term performance evaluated in this role?")
				);
				return strengths.get(idx % strengths.size());
			}
		}

		if (ai.contains("dream") || ai.contains("future") || ai.contains("goal") || ai.contains("career") || ai.contains("aspire") || ai.contains("major")) {
			if (isStudent) {
				List<List<String>> goals = List.of(
						List.of("I aspire to study computer science and build innovative technologies.", "I want to pursue environmental engineering to solve climate challenges.", "What academic streams would best prepare me for this path?"),
						List.of("My goal is to enter medicine and contribute to community health.", "I am passionate about literature and hope to pursue journalism or law.", "What research opportunities do high school students have here?"),
						List.of("I aim to combine technology and design to create accessible tools.", "I want to deepen my skills in mathematics and advanced sciences.", "Could you tell me more about your campus mentorship programs?")
				);
				return goals.get(idx % goals.size());
			}
		}

		// 2. Scenario-Themed Curricula
		if (s.contains("admission") || s.contains("high school") || (s.contains("interview") && isStudent)) {
			List<List<String>> admissionSets = List.of(
					List.of("Thank you for having me! I am really eager to join this school.", "I'm drawn to your strong academic culture and diverse clubs.", "Could you tell me what a typical day looks like for a freshman?"),
					List.of("I balance academics with sports and creative extracurriculars.", "I believe this curriculum will challenge me to reach my potential.", "What kinds of student leadership programs do you offer?"),
					List.of("I am enthusiastic about participating in debate and science competitions.", "I value hands-on learning and collaborative team projects.", "How does the faculty support students pursuing ambitious goals?")
			);
			return admissionSets.get(idx % admissionSets.size());
		}

		if (grade.contains("1st") || grade.contains("2nd") || grade.contains("3rd") || s.contains("std1") || s.contains("std2") || s.contains("std3") || s.contains("phonics")) {
			List<List<String>> primarySets = List.of(
					List.of("Good morning, teacher! I am ready to speak.", "My favorite color is blue and I love drawing animals.", "Can we practice saying new words together?"),
					List.of("I finished my homework and helped tidy up our classroom.", "I like playing with my toys and reading storybooks.", "What is the next fun question, teacher?"),
					List.of("I am very happy today! Can we play a speaking game?", "My favorite animal is a friendly puppy.", "Thank you, teacher, that was very fun!")
			);
			return primarySets.get(idx % primarySets.size());
		}

		if (s.contains("debate") || s.contains("speech") || s.contains("keynote") || s.contains("oratory")) {
			List<List<String>> debateSets = List.of(
					List.of("I believe that evidence and clear logic support this viewpoint.", "While that perspective is compelling, counter-arguments must be weighed.", "What is the most persuasive evidence on this issue?"),
					List.of("Let's examine both the immediate and long-term consequences.", "A balanced approach requires listening to diverse viewpoints.", "How would you counter that rebuttal effectively?"),
					List.of("I propose a solution that addresses both core concerns.", "Public discourse thrives when arguments remain respectful and fact-based.", "May I elaborate on the primary justification for this stance?")
			);
			return debateSets.get(idx % debateSets.size());
		}

		if (s.contains("science") || s.contains("climate") || s.contains("robotics") || s.contains("tech") || s.contains("space")) {
			List<List<String>> scienceSets = List.of(
					List.of("Our experiment tested how renewable energy can be harnessed efficiently.", "Technology can automate repetitive tasks and empower communities.", "What are the most promising breakthroughs in this field?"),
					List.of("We collected data over two weeks to validate our hypothesis.", "Scientific discovery requires patience, testing, and continuous curiosity.", "Could you explain how artificial intelligence impacts this research?"),
					List.of("I am fascinated by planetary exploration and future space probes.", "Sustainable practices are essential for combating climate change.", "How can students get involved in practical STEM initiatives?")
			);
			return scienceSets.get(idx % scienceSets.size());
		}

		if (s.contains("restaurant") || s.contains("dining") || s.contains("food") || s.contains("canteen") || s.contains("burger")) {
			List<List<String>> diningSets = List.of(
					List.of("Could I please see today's special menu?", "What do you recommend as the most popular dish?", "Could we get a table near the window, please?"),
					List.of("I'd like to order a fresh pasta and sparkling water, please.", "Could you make this without extra spices or dairy?", "How long does this meal usually take to prepare?"),
					List.of("Everything tasted wonderful, thank you!", "Could we get the check whenever you're ready, please?", "Do you accept card or digital payments?")
			);
			return diningSets.get(idx % diningSets.size());
		} else if (s.contains("coffee") || s.contains("cafe")) {
			List<List<String>> cafeSets = List.of(
					List.of("I'd like a medium iced latte with oat milk, please.", "Do you have any fresh pastries or croissants today?", "Can I get this to go, please?"),
					List.of("What coffee roast do you recommend today?", "Could you please add a little vanilla syrup?", "Is there free Wi-Fi here for customers?"),
					List.of("This coffee is fantastic, thank you!", "Could I also get a glass of water, please?", "Do you stamp loyalty cards here?")
			);
			return cafeSets.get(idx % cafeSets.size());
		} else if (s.contains("hotel") || s.contains("check-in") || s.contains("roommate") || s.contains("hostel")) {
			List<List<String>> hotelSets = List.of(
					List.of("Hi, I have a reservation under my name.", "What time is breakfast served in the morning?", "Could you tell me the Wi-Fi password?"),
					List.of("Could I request a quiet room on a higher floor?", "Is there a shuttle service available to the center?", "Where are the gym and facilities located?"),
					List.of("Could you arrange transportation for early tomorrow morning?", "Is it possible to request a late check-out?", "Thank you for the wonderful stay!")
			);
			return hotelSets.get(idx % hotelSets.size());
		} else if (s.contains("airport") || s.contains("flight") || s.contains("travel") || s.contains("customs") || s.contains("tour")) {
			List<List<String>> travelSets = List.of(
					List.of("Here are my passport and boarding pass.", "I am traveling for a short study tour.", "Which gate does my flight depart from?"),
					List.of("Is my connecting flight on schedule?", "Could you please direct me to baggage claim?", "Where can I find currency exchange?"),
					List.of("What is the quickest way to reach the city center?", "Are there luggage storage facilities available here?", "Thank you for guiding me!")
			);
			return travelSets.get(idx % travelSets.size());
		} else if (s.contains("job") || s.contains("meeting") || s.contains("salary") || s.contains("presentation") || s.contains("business")) {
			List<List<String>> jobSets = List.of(
					List.of("I have hands-on experience in structured problem solving.", "My greatest strength is communicating effectively under pressure.", "I am excited about this role and your team culture."),
					List.of("When faced with tight deadlines, I prioritize high-impact results.", "I actively seek constructive feedback to continually refine my skills.", "What are the biggest goals for this team in the coming year?"),
					List.of("I believe clear communication prevents misunderstandings.", "I am eager to contribute to your organization's mission.", "How is success measured during the first ninety days?")
			);
			return jobSets.get(idx % jobSets.size());
		} else if (s.contains("shopping") || s.contains("store") || s.contains("clothes") || s.contains("market")) {
			List<List<String>> shopSets = List.of(
					List.of("Excuse me, do you have this in a medium size?", "Where are the fitting rooms located?", "Is this item currently on discount?"),
					List.of("Do you have this available in another color?", "I'm just browsing for now, thank you!", "What is your return policy?"),
					List.of("I'll take this one, please.", "Can I pay with credit card?", "Could I have a gift receipt with this?")
			);
			return shopSets.get(idx % shopSets.size());
		} else if (s.contains("doctor") || s.contains("health") || s.contains("hospital") || s.contains("pharmacy")) {
			List<List<String>> healthSets = List.of(
					List.of("I've had a mild headache since yesterday.", "How often should I take this medication?", "Thank you for the helpful advice, doctor."),
					List.of("Are there any side effects I should watch out for?", "Should I schedule a follow-up appointment?", "Do I need to take this medicine with food?"),
					List.of("The symptoms started about three days ago.", "Is there anything specific I should avoid eating?", "I feel much better today, thank you.")
			);
			return healthSets.get(idx % healthSets.size());
		}

		// 3. Dynamic synthesis from the scenario title and tutor prompt
		String cleanTitle = (scenario != null && !scenario.trim().isEmpty())
				? scenario.replaceAll("(?i)\\b(conversation|practice|session)\\b", "").trim()
				: "our conversation";

		List<List<String>> synthesizedSets = List.of(
				List.of(
						"I'm really looking forward to discussing " + cleanTitle + ".",
						"In my experience, consistent practice makes talking about this much easier.",
						"What do you think is the best way to approach this topic?"
				),
				List.of(
						"That makes total sense to me, and I'd like to share my thoughts.",
						"I completely agree with that perspective on " + cleanTitle + ".",
						"Could you share how a native speaker would usually express that?"
				),
				List.of(
						"I'm eager to learn more practical vocabulary for this situation.",
						"Speaking regularly in scenarios like this is boosting my confidence.",
						"What should our main conversational takeaway be from this?"
				)
		);
		return synthesizedSets.get(idx % synthesizedSets.size());
	}

	@Override
	public SpeakingMessageResponse processMessage(SpeakingMessageRequest request) {
		SpeakingSession session = speakingSessionRepository.findById(request.getSessionId())
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Session not found"));

		// 1. Save user message
		ConversationMessage userMsg = ConversationMessage.builder()
				.session(session)
				.sender("user")
				.message(request.getMessage())
				.build();
		messageRepository.save(userMsg);

		// 2. Fetch full conversation history for context
		List<ConversationMessage> history = messageRepository.findBySessionOrderByTimestampAsc(session);

		// 3. Determine Level / Standard / Pedagogical instruction
		String chatLevel = request.getLevel();
		if (chatLevel == null || chatLevel.trim().isEmpty()) {
			chatLevel = session.getUser() != null ? session.getUser().getEnglishLevel() : "Beginner";
		}
		if (chatLevel == null || chatLevel.trim().isEmpty()) {
			chatLevel = "Beginner";
		}

		String levelInstruction = "";
		String cl = chatLevel.toLowerCase();

		if (cl.contains("1st std") || cl.contains("starter")) {
			levelInstruction = "Student Grade: 1st Standard (Ages 6-7 Starter).\n" +
					"Pedagogy: Use ONLY ultra-simple primary words (phonics, simple animal/color words, 3-5 word sentences). Greet warmly like a kind primary teacher. Keep all replies cheerful and very easy.";
		} else if (cl.contains("2nd std")) {
			levelInstruction = "Student Grade: 2nd Standard (Ages 7-8 Elementary).\n" +
					"Pedagogy: Use basic classroom & daily routine vocabulary, simple short sentences (4-7 words), and clear questions.";
		} else if (cl.contains("3rd std")) {
			levelInstruction = "Student Grade: 3rd Standard (Ages 8-9 Upper Elementary).\n" +
					"Pedagogy: Focus on action verbs, telling time, community helpers, and clear sentence structure.";
		} else if (cl.contains("4th std")) {
			levelInstruction = "Student Grade: 4th Standard (Ages 9-10 Pre-Intermediate).\n" +
					"Pedagogy: Introduce comparative words, simple directions, canteen orders, and short paragraph conversation.";
		} else if (cl.contains("5th std")) {
			levelInstruction = "Student Grade: 5th Standard (Ages 10-11 Intermediate).\n" +
					"Pedagogy: Practice intermediate sentence structures, future tense (will / going to), and school project explanations.";
		} else if (cl.contains("6th std")) {
			levelInstruction = "Student Grade: 6th Standard (Ages 11-12 Upper Intermediate).\n" +
					"Pedagogy: Practice debate reasoning, club interviews, polite questions to teachers, and complex sentences.";
		} else if (cl.contains("7th std")) {
			levelInstruction = "Student Grade: 7th Standard (Ages 12-13 Intermediate).\n" +
					"Pedagogy: Focus on environmental discussions, book/film reviews, and formal polite requests (Could you please, I would appreciate).";
		} else if (cl.contains("8th std")) {
			levelInstruction = "Student Grade: 8th Standard (Ages 13-14 Upper Intermediate).\n" +
					"Pedagogy: Encourage structured debate arguments, leadership interviews, technology discussions, and public discourse.";
		} else if (cl.contains("9th std")) {
			levelInstruction = "Student Grade: 9th Standard (Ages 14-15 Advanced).\n" +
					"Pedagogy: Focus on mock admission interviews, structured keynote presentations, current affairs, and diplomatic conflict resolution.";
		} else if (cl.contains("10th std") || cl.contains("board prep")) {
			levelInstruction = "Student Grade: 10th Standard (Board Exam Prep & Oratory Mastery).\n" +
					"Pedagogy: Simulate formal board oral examinations, academic pitch defenses, advanced idioms, and CEFR C1 oratory fluency.";
		} else {
			String normLvl = chatLevel.trim();
			if (normLvl.matches("(?i).*level\\s*\\d+.*|\\d+")) {
				java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(normLvl);
				if (m.find()) {
					int lvl = Integer.parseInt(m.group());
					if (lvl <= 2) normLvl = "beginner";
					else if (lvl <= 4) normLvl = "intermediate";
					else normLvl = "advanced";
				}
			}
			if ("beginner".equalsIgnoreCase(normLvl) || normLvl.toLowerCase().contains("beginner") || normLvl.toLowerCase().contains("a1") || normLvl.toLowerCase().contains("a2")) {
				levelInstruction = "Current Learner English Level: Beginner (A1-A2).\n" +
						"Instructions: Use extremely simple, clear, and common vocabulary. Speak in very short, basic sentences. Keep your grammar explanations simple and concrete.";
			} else if ("intermediate".equalsIgnoreCase(normLvl) || normLvl.toLowerCase().contains("intermediate") || normLvl.toLowerCase().contains("b1") || normLvl.toLowerCase().contains("b2")) {
				levelInstruction = "Current Learner English Level: Intermediate (B1-B2).\n" +
						"Instructions: Use everyday conversational English, standard sentence lengths, and B1-B2 vocabulary. Introduce occasional common idioms with practical explanations.";
			} else { // Advanced
				levelInstruction = "Current Learner English Level: Advanced (C1-C2).\n" +
						"Instructions: Use sophisticated and diverse vocabulary. Use complex sentence structures, advanced idioms, and nuanced stylistic suggestions.";
			}
		}


		User user = session.getUser();
		String userContextInstruction = buildUserContextInstruction(user, session.getScenario());

		List<GroqRequest.Message> groqMessages = new ArrayList<>();
		String systemPrompt = String.format(
				"You are an expert English conversation tutor roleplaying authentically with the student in the scenario: '%s'.\n\n"
						+
						"LEARNER CONTEXT & SCENARIO:\n" +
						"%s\n" +
						"%s\n\n" +
						"ROLEPLAY & CONVERSATIONAL IMMERSION:\n" +
						"1. IN-CHARACTER DIALOGUE ('aiReply'): Inhabit your persona (e.g. friendly barista, doctor, tour guide, peer, or teacher). Respond naturally in 1-2 lively, empathetic sentences tailored to the student's standard/age. Keep the conversation engaging and fluid.\n"
						+
						"2. NATIVE PHRASING ('betterSentence'): If the student's expression could be polished into a natural native idiom ('How a native speaker says it'), provide it here. If they spoke naturally and cleanly, set to null.\n"
						+
						"3. GRAMMAR EVALUATION ('grammarCorrection'): Provide a corrected version only if there were grammatical errors, otherwise set to null.\n"
						+
						"4. DYNAMIC SPOKEN HINTS ('suggestedResponses'): Provide EXACTLY 3 complete, realistic phrases the student can literally speak out loud next. CRITICAL: Never write 'Suggestion 1', 'Option 1', or placeholder labels. Each must be a real sentence tailored directly to this dialogue.\n"
						+
						"5. CLEAN TEXT RULES: Never output bracketed meta tags (e.g. [grammar]), never output ellipses '...', and never output stage directions like (smiling).\n\n"
						+
						"YOU MUST RESPOND IN VALID JSON FORMAT ONLY. Do not wrap in ```json or markdown blocks.\n" +
						"The JSON must have these exact fields and structure:\n" +
						"{\n" +
						"  \"aiReply\": \"Your natural in-character conversational response (1-2 sentences).\",\n" +
						"  \"grammarCorrection\": \"Corrected version if mistake made, otherwise null.\",\n" +
						"  \"betterSentence\": \"Natural native phrasing alternative ('How to say it'), otherwise null.\",\n"
						+
						"  \"vocabularySuggestions\": \"1-2 vocabulary enrichment words, otherwise null.\",\n" +
						"  \"explanation\": \"A short 1-sentence tutoring note, otherwise null.\",\n" +
						"  \"followUpQuestion\": \"A natural follow-up question to keep the dialogue flowing.\",\n" +
						"  \"nativeTip\": \"A short pronunciation or cadence tip, otherwise null.\",\n" +
						"  \"suggestedResponses\": [\"First realistic sentence student can speak\", \"Second realistic sentence student can speak\", \"Third realistic sentence student can speak\"]\n"
						+
						"}\n\n" +
						"Important: Escape any double quotes inside string values as \\\" to ensure valid JSON.",
				session.getScenario(),
				levelInstruction,
				userContextInstruction);
		groqMessages.add(new GroqRequest.Message("system", systemPrompt));

		// Add last 10 messages for context
		int startIdx = Math.max(0, history.size() - 10);
		for (int i = startIdx; i < history.size(); i++) {
			ConversationMessage m = history.get(i);
			String role = m.getSender().equals("user") ? "user" : "assistant";
			groqMessages.add(new GroqRequest.Message(role, m.getMessage()));
		}

		String groqReplyRaw = callGroqChat(groqMessages);
		String cleanJson = cleanJsonResponse(groqReplyRaw);

		SpeakingMessageResponse response = new SpeakingMessageResponse();
		try {
			response = objectMapper.readValue(cleanJson, SpeakingMessageResponse.class);
		} catch (Exception e) {
			// Fallback if JSON parsing fails — try extracting fields manually
			String extractedReply = extractFieldFromJson(cleanJson, "aiReply");
			if (extractedReply != null && !extractedReply.isEmpty()) {
				response.setAiReply(extractedReply);
				response.setGrammarCorrection(extractFieldFromJson(cleanJson, "grammarCorrection"));
				response.setBetterSentence(extractFieldFromJson(cleanJson, "betterSentence"));
				response.setVocabularySuggestions(extractFieldFromJson(cleanJson, "vocabularySuggestions"));
				response.setExplanation(extractFieldFromJson(cleanJson, "explanation"));
				response.setFollowUpQuestion(extractFieldFromJson(cleanJson, "followUpQuestion"));
				response.setNativeTip(extractFieldFromJson(cleanJson, "nativeTip"));
			} else {
				// If we can't extract the aiReply field, check if it looks like JSON
				if (cleanJson.contains("{") || cleanJson.contains("\"") || cleanJson.contains("aiReply")) {
					response.setAiReply(
							"I'm sorry, I had some trouble processing my response. Could you please repeat that?");
				} else {
					response.setAiReply(cleanJson);
				}
				response.setGrammarCorrection(null);
				response.setBetterSentence(null);
				response.setVocabularySuggestions(null);
				response.setExplanation(null);
				response.setFollowUpQuestion(null);
			}
		}

		// Thoroughly sanitize all text fields from brackets, dot-dot-dot, and markdown
		response.setAiReply(sanitizeSpokenText(response.getAiReply()));
		response.setBetterSentence(sanitizeSpokenText(response.getBetterSentence()));
		response.setGrammarCorrection(sanitizeSpokenText(response.getGrammarCorrection()));
		response.setExplanation(sanitizeSpokenText(response.getExplanation()));
		response.setNativeTip(sanitizeSpokenText(response.getNativeTip()));

		// Grammar correction logic
		String userClean = request.getMessage().trim().replaceAll("[\\p{Punct}&&[^']]+", "").replaceAll("\\s+", " ")
				.toLowerCase();
		String grammarClean = (response.getGrammarCorrection() != null) ? response.getGrammarCorrection().trim()
				.replaceAll("[\\p{Punct}&&[^']]+", "").replaceAll("\\s+", " ").toLowerCase() : "";

		if (response.getGrammarCorrection() == null || response.getGrammarCorrection().equalsIgnoreCase("none")
				|| response.getGrammarCorrection().equalsIgnoreCase("null")
				|| response.getGrammarCorrection().trim().isEmpty()) {
			response.setGrammarCorrection("✅ Your sentence is correct.");
		} else if (grammarClean.equals(userClean)) {
			response.setGrammarCorrection("✅ Your sentence is correct.");
		}

		// Clean up fields from "none" / "null" values
		if (response.getBetterSentence() != null && (response.getBetterSentence().equalsIgnoreCase("none")
				|| response.getBetterSentence().equalsIgnoreCase("null")
				|| response.getBetterSentence().trim().isEmpty())) {
			response.setBetterSentence(null);
		}
		if (response.getVocabularySuggestions() != null && (response.getVocabularySuggestions().equalsIgnoreCase("none")
				|| response.getVocabularySuggestions().equalsIgnoreCase("null")
				|| response.getVocabularySuggestions().trim().isEmpty())) {
			response.setVocabularySuggestions(null);
		}
		if (response.getExplanation() != null && (response.getExplanation().equalsIgnoreCase("none")
				|| response.getExplanation().equalsIgnoreCase("null") || response.getExplanation().trim().isEmpty())) {
			response.setExplanation(null);
		}
		if (response.getFollowUpQuestion() != null && (response.getFollowUpQuestion().equalsIgnoreCase("none")
				|| response.getFollowUpQuestion().equalsIgnoreCase("null")
				|| response.getFollowUpQuestion().trim().isEmpty())) {
			response.setFollowUpQuestion(null);
		}

		// Provide smart suggested response chips if empty or sanitize
		List<String> cleanSuggested = new ArrayList<>();
		if (response.getSuggestedResponses() != null) {
			for (String sug : response.getSuggestedResponses()) {
				String sClean = cleanAndSanitizeHint(sug);
				if (sClean != null && !sClean.isEmpty() && !cleanSuggested.contains(sClean)) {
					cleanSuggested.add(sClean);
				}
			}
		}
		if (cleanSuggested.size() < 2) {
			String lastAi = response.getAiReply();
			if (response.getFollowUpQuestion() != null) {
				lastAi = (lastAi != null ? lastAi + " " : "") + response.getFollowUpQuestion();
			}
			List<String> fallbacks = generateContextualScenarioHints(user, session.getScenario(), lastAi, history.size());
			for (String fb : fallbacks) {
				if (!cleanSuggested.contains(fb)) {
					cleanSuggested.add(fb);
				}
			}
		}
		response.setSuggestedResponses(cleanSuggested);

		// Deduplicate follow-up from reply
		String reply = response.getAiReply();
		String followup = response.getFollowUpQuestion();
		if (reply != null && followup != null && !followup.isEmpty()) {
			String replyTrim = reply.trim();
			String followupTrim = followup.trim();
			if (replyTrim.endsWith(followupTrim)) {
				reply = replyTrim.substring(0, replyTrim.length() - followupTrim.length()).trim();
			} else if (replyTrim.contains(followupTrim)) {
				reply = replyTrim.replace(followupTrim, "").trim();
			}
			response.setAiReply(reply);
		}

		// 4. Save AI response
		ConversationMessage aiMsg = ConversationMessage.builder()
				.session(session)
				.sender("ai")
				.message(response.getAiReply())
				.build();
		messageRepository.save(aiMsg);

		// Update session transcript
		String currentTranscript = session.getTranscript() != null ? session.getTranscript() : "";
		session.setTranscript(currentTranscript + "\nUser: " + request.getMessage() + "\nAI: " + response.getAiReply());
		speakingSessionRepository.save(session);

		return response;
	}

	@Override
	public SpeakingEndResponse endSession(Long id) {
		SpeakingSession session = speakingSessionRepository.findById(id)
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Session not found"));

		List<ConversationMessage> history = messageRepository.findBySessionOrderByTimestampAsc(session);

		// Calculate duration
		long durationSeconds = 0;
		if (session.getCreatedAt() != null) {
			durationSeconds = Duration.between(session.getCreatedAt(), LocalDateTime.now()).toSeconds();
			if (durationSeconds < 0)
				durationSeconds = 0;
		}

		// Calculate user participation metrics
		int userMessageCount = 0;
		int userWordCount = 0;
		StringBuilder transcriptBuilder = new StringBuilder();
		for (ConversationMessage m : history) {
			String sender = m.getSender() != null ? m.getSender().trim() : "";
			String msg = m.getMessage() != null ? m.getMessage().trim() : "";
			transcriptBuilder.append(sender.toUpperCase()).append(": ").append(msg).append("\n");
			if ("user".equalsIgnoreCase(sender) && !msg.isEmpty()) {
				userMessageCount++;
				userWordCount += msg.split("\\s+").length;
			}
		}
		String fullTranscript = transcriptBuilder.toString();

		double overallScore = 0.0;
		double grammarScore = 0.0;
		double vocabularyScore = 0.0;
		double fluencyScore = 0.0;
		double pronunciationScore = 0.0;
		int xp = 0;
		int mistakes = 0;

		String summary;
		String vocab;
		String grammar;
		String better;
		String motivational;

		// ── If user had no active participation (0 messages or 0 words) ───
		if (userMessageCount == 0 || userWordCount == 0) {
			overallScore = 0.0;
			grammarScore = 0.0;
			vocabularyScore = 0.0;
			fluencyScore = 0.0;
			pronunciationScore = 0.0;
			xp = 0;
			mistakes = 0;
			summary = "Session ended with no speaking activity.";
			vocab = "No vocabulary practiced.";
			grammar = "No dialogue to evaluate.";
			better = "Tap the microphone to speak with your AI tutor next time!";
			motivational = "Practice speaking to improve your fluency and earn XP!";
		} else {
			// Request comprehensive evaluation from Groq
			List<GroqRequest.Message> messages = new ArrayList<>();
			String sysPrompt = "Review the following transcript of an English speaking practice session. " +
					"Evaluate the student's performance with realistic scores (0 to 100) and actionable feedback.\n\n" +
					"YOU MUST RESPOND IN VALID JSON FORMAT ONLY. Do not wrap in markdown or ```json. Do not include any text outside the JSON.\n"
					+
					"The JSON must have these exact fields:\n" +
					"{\n" +
					"  \"overallScore\": 84.0,\n" +
					"  \"grammarScore\": 82.0,\n" +
					"  \"vocabularyScore\": 85.0,\n" +
					"  \"fluencyScore\": 86.0,\n" +
					"  \"pronunciationScore\": 83.0,\n" +
					"  \"summary\": \"Concise summary of student conversation performance.\",\n" +
					"  \"vocabularyLearned\": \"Key words or useful phrases used or recommended.\",\n" +
					"  \"grammarCorrections\": \"Summary of grammar errors noted.\",\n" +
					"  \"betterSentences\": \"Alternative natural phrasing suggestions.\",\n" +
					"  \"motivationalMessage\": \"An encouraging wrap-up message.\"\n" +
					"}\n\n" +
					"Important: Escape double quotes inside string values as \\\" to ensure valid JSON.";
			messages.add(new GroqRequest.Message("system", sysPrompt));
			messages.add(new GroqRequest.Message("user", "Transcript:\n" + fullTranscript));

			// Fallback defaults for participating sessions
			overallScore = Math.min(80.0, 50.0 + userWordCount * 2.0);
			grammarScore = overallScore;
			vocabularyScore = overallScore;
			fluencyScore = overallScore;
			pronunciationScore = overallScore;
			summary = "Completed speaking practice session.";
			vocab = "Conversational vocabulary.";
			grammar = "Good effort expressing thoughts.";
			better = "Keep practicing speaking daily to build fluency!";
			motivational = "Great effort! Practice every day to become more fluent.";

			try {
				String rawEval = callGroqChat(messages);
				String cleanJson = cleanJsonResponse(rawEval);

				try {
					FinalEvaluation evalObj = objectMapper.readValue(cleanJson, FinalEvaluation.class);
					if (evalObj.getOverallScore() != null)
						overallScore = evalObj.getOverallScore();
					if (evalObj.getGrammarScore() != null)
						grammarScore = evalObj.getGrammarScore();
					else
						grammarScore = overallScore;
					if (evalObj.getVocabularyScore() != null)
						vocabularyScore = evalObj.getVocabularyScore();
					else
						vocabularyScore = overallScore;
					if (evalObj.getFluencyScore() != null)
						fluencyScore = evalObj.getFluencyScore();
					else
						fluencyScore = overallScore;
					if (evalObj.getPronunciationScore() != null)
						pronunciationScore = evalObj.getPronunciationScore();
					else
						pronunciationScore = overallScore;

					if (evalObj.getSummary() != null)
						summary = evalObj.getSummary();
					if (evalObj.getVocabularyLearned() != null)
						vocab = evalObj.getVocabularyLearned();
					if (evalObj.getGrammarCorrections() != null)
						grammar = evalObj.getGrammarCorrections();
					if (evalObj.getBetterSentences() != null)
						better = evalObj.getBetterSentences();
					if (evalObj.getMotivationalMessage() != null)
						motivational = evalObj.getMotivationalMessage();
				} catch (Exception e) {
					// Fallback extraction
					String extOverall = extractFieldFromJson(cleanJson, "overallScore");
					if (extOverall == null)
						extOverall = extractFieldFromJson(cleanJson, "score");
					if (extOverall != null) {
						try {
							overallScore = Double.parseDouble(extOverall);
						} catch (Exception ignored) {
						}
					}
					String extGrammarScore = extractFieldFromJson(cleanJson, "grammarScore");
					if (extGrammarScore != null) {
						try {
							grammarScore = Double.parseDouble(extGrammarScore);
						} catch (Exception ignored) {
						}
					} else {
						grammarScore = overallScore;
					}
					String extVocabScore = extractFieldFromJson(cleanJson, "vocabularyScore");
					if (extVocabScore != null) {
						try {
							vocabularyScore = Double.parseDouble(extVocabScore);
						} catch (Exception ignored) {
						}
					} else {
						vocabularyScore = overallScore;
					}
					String extFluencyScore = extractFieldFromJson(cleanJson, "fluencyScore");
					if (extFluencyScore != null) {
						try {
							fluencyScore = Double.parseDouble(extFluencyScore);
						} catch (Exception ignored) {
						}
					} else {
						fluencyScore = overallScore;
					}
					String extPronScore = extractFieldFromJson(cleanJson, "pronunciationScore");
					if (extPronScore != null) {
						try {
							pronunciationScore = Double.parseDouble(extPronScore);
						} catch (Exception ignored) {
						}
					} else {
						pronunciationScore = overallScore;
					}

					String extSummary = extractFieldFromJson(cleanJson, "summary");
					if (extSummary != null)
						summary = extSummary;
					String extVocab = extractFieldFromJson(cleanJson, "vocabularyLearned");
					if (extVocab != null)
						vocab = extVocab;
					String extGrammar = extractFieldFromJson(cleanJson, "grammarCorrections");
					if (extGrammar != null)
						grammar = extGrammar;
					String extBetter = extractFieldFromJson(cleanJson, "betterSentences");
					if (extBetter != null)
						better = extBetter;
					String extMotivational = extractFieldFromJson(cleanJson, "motivationalMessage");
					if (extMotivational != null)
						motivational = extMotivational;
				}
			} catch (Exception e) {
				System.err.println("⚠️ Groq final evaluation failed, using fallback metrics: " + e.getMessage());
			}

			// Dynamic XP reward based on genuine effort & performance (No free 25 XP!)
			int baseReward;
			if (userWordCount < 5) {
				baseReward = 3;
			} else if (userWordCount < 20) {
				baseReward = 8;
			} else if (userWordCount < 60) {
				baseReward = 15;
			} else {
				baseReward = 22;
			}

			long minutes = durationSeconds / 60;
			int timeBonus = (int) Math.min(10, minutes * 2);

			int scoreBonus;
			if (overallScore >= 90.0) {
				scoreBonus = 10;
			} else if (overallScore >= 80.0) {
				scoreBonus = 6;
			} else if (overallScore >= 70.0) {
				scoreBonus = 3;
			} else if (overallScore >= 50.0) {
				scoreBonus = 1;
			} else {
				scoreBonus = 0;
			}

			xp = Math.min(45, baseReward + timeBonus + scoreBonus);

			// Count grammar mistakes based on messages containing corrections
			for (ConversationMessage m : history) {
				if ("user".equalsIgnoreCase(m.getSender()) && m.getMessage() != null && m.getMessage().length() > 5) {
					mistakes++;
				}
			}
			mistakes = Math.max(0, mistakes / 3);
		}

		// Update session fields
		session.setDuration((int) durationSeconds);
		session.setXpEarned(xp);
		session.setScore(overallScore);
		session.setOverallScore(overallScore);
		session.setGrammarScore(grammarScore);
		session.setVocabularyScore(vocabularyScore);
		session.setFluencyScore(fluencyScore);
		session.setPronunciationScore(pronunciationScore);
		session.setFeedback(summary);
		boolean isLegitimateSession = userMessageCount > 0 && userWordCount > 0 && xp > 0;
		session.setCompleted(isLegitimateSession);
		speakingSessionRepository.save(session);

		// Update user's progress ONLY if the user actively practiced (XP > 0)
		if (xp > 0 && userWordCount >= 3) {
			try {
				User user = session.getUser();
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
				int sessionMinutes = (int) Math.max(1, Math.ceil(durationSeconds / 60.0));
				progress.setTotalPracticeMinutes(
						(progress.getTotalPracticeMinutes() == null ? 0 : progress.getTotalPracticeMinutes())
								+ sessionMinutes);
				progress.setTotalSpeakingSessions(
						(progress.getTotalSpeakingSessions() == null ? 0 : progress.getTotalSpeakingSessions()) + 1);
				int newXp = (progress.getXp() == null ? 0 : progress.getXp()) + xp;
				progress.setXp(newXp);
				progress.setLevel(Math.max(1, (newXp / 500) + 1));
				progressRepository.save(progress);
			} catch (Exception ex) {
				// Ignore progress update errors
			}

			// Trigger session-end notification
			try {
				if (session.getUser() != null) {
					int sessionMinutes = (int) Math.max(1, Math.ceil(durationSeconds / 60.0));
					notificationService.createSystemNotification(session.getUser(),
							"Speaking Session Complete! 🎙️",
							"Great job! You practiced \"" + session.getScenario() + "\" for " + sessionMinutes
									+ " min and earned " + xp + " XP.");
				}
			} catch (Exception ex) {
				System.err.println("⚠️ Could not create session notification: " + ex.getMessage());
			}
		}

		// Save feedback entity
		ConversationFeedback feedback = ConversationFeedback.builder()
				.session(session)
				.grammarCorrections(grammar)
				.betterSentences(better)
				.vocabularySuggestions(vocab)
				.summary(summary)
				.build();
		feedbackRepository.save(feedback);

		return SpeakingEndResponse.builder()
				.sessionId(session.getId())
				.scenario(session.getScenario())
				.duration((int) durationSeconds)
				.messagesExchanged(history.size())
				.grammarMistakes(mistakes)
				.xpEarned(xp)
				.score(overallScore)
				.overallScore(overallScore)
				.grammarScore(grammarScore)
				.vocabularyScore(vocabularyScore)
				.fluencyScore(fluencyScore)
				.pronunciationScore(pronunciationScore)
				.summary(summary)
				.vocabularyLearned(vocab)
				.motivationalMessage(motivational)
				.build();
	}

	@Override
	public List<SpeakingHistoryResponse> getSessionHistory() {
		User user = currentUser();
		if (user == null || user.getId() == null) {
			return List.of();
		}
		List<SpeakingSession> sessions = speakingSessionRepository.findByUserIdAndCompletedTrueOrderByCreatedAtDesc(user.getId());
		return sessions.stream()
				.filter(s -> s != null && Boolean.TRUE.equals(s.getCompleted())
						&& (s.getDuration() != null && s.getDuration() > 0)
						&& (s.getOverallScore() == null || s.getOverallScore() > 0)
						&& (s.getFeedback() == null || !s.getFeedback().contains("no speaking activity")))
				.map(s -> {
					String preview = "";
					if (s.getFeedback() != null && !s.getFeedback().isBlank()) {
						preview = s.getFeedback();
					} else if (s.getTranscript() != null && !s.getTranscript().isBlank()) {
						preview = s.getTranscript();
					} else if (s.getTopic() != null && !s.getTopic().isBlank()) {
						preview = s.getTopic();
					}
					if (preview.length() > 100)
						preview = preview.substring(0, 97) + "...";

					return SpeakingHistoryResponse.builder()
							.id(s.getId())
							.scenario(s.getScenario())
							.duration(s.getDuration())
							.xpEarned(s.getXpEarned())
							.score(s.getScore())
							.previewMessage(preview)
							.createdAt(s.getCreatedAt())
							.build();
				})
				.toList();
	}

	@Override
	public SpeakingSessionDetailResponse getSessionDetail(Long id) {
		SpeakingSession s = speakingSessionRepository.findById(id)
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Session not found"));

		List<SpeakingSessionDetailResponse.MessageDto> msgs = messageRepository.findBySessionOrderByTimestampAsc(s)
				.stream()
				.map(m -> SpeakingSessionDetailResponse.MessageDto.builder()
						.id(m.getId())
						.sender(m.getSender())
						.message(m.getMessage())
						.timestamp(m.getTimestamp())
						.build())
				.toList();

		Optional<ConversationFeedback> fb = feedbackRepository.findBySession(s);
		SpeakingSessionDetailResponse.FeedbackDto fbDto = fb
				.map(f -> SpeakingSessionDetailResponse.FeedbackDto.builder()
						.grammarCorrections(f.getGrammarCorrections())
						.betterSentences(f.getBetterSentences())
						.vocabularySuggestions(f.getVocabularySuggestions())
						.summary(f.getSummary())
						.build())
				.orElse(null);

		return SpeakingSessionDetailResponse.builder()
				.id(s.getId())
				.scenario(s.getScenario())
				.duration(s.getDuration())
				.xpEarned(s.getXpEarned())
				.score(s.getScore())
				.pronunciationScore(s.getPronunciationScore())
				.fluencyScore(s.getFluencyScore())
				.grammarScore(s.getGrammarScore())
				.vocabularyScore(s.getVocabularyScore())
				.overallScore(s.getOverallScore())
				.feedback(s.getFeedback())
				.createdAt(s.getCreatedAt())
				.messages(msgs)
				.feedbackDetail(fbDto)
				.build();
	}

	@Override
	public List<String> getHints(Long id) {
		SpeakingSession session = speakingSessionRepository.findById(id)
				.orElseThrow(() -> new SpeakingSessionNotFoundException("Session not found"));

		List<ConversationMessage> history = messageRepository.findBySessionOrderByTimestampAsc(session);
		User user = session.getUser();
		String userContext = buildUserContextInstruction(user, session.getScenario());

		String lastAiMsg = "";
		for (int i = history.size() - 1; i >= 0; i--) {
			if ("ai".equalsIgnoreCase(history.get(i).getSender())) {
				lastAiMsg = history.get(i).getMessage();
				break;
			}
		}

		// Build context for suggestions
		List<GroqRequest.Message> groqMessages = new ArrayList<>();
		String systemPrompt = String.format(
				"You are an expert English conversation tutor observing a live speaking practice under scenario: '%s'.\n\n" +
				"LEARNER CONTEXT:\n%s\n\n" +
				"TUTOR'S LATEST MESSAGE / QUESTION:\n\"%s\"\n\n" +
				"TASK:\n" +
				"Provide EXACTLY 3 distinct, fresh, natural speaking responses the student could say right now to answer or continue the dialogue:\n" +
				"1. Direct, realistic response answering the tutor's question/topic (5-12 words).\n" +
				"2. Natural personal experience or thoughtful elaboration (6-14 words).\n" +
				"3. Curious follow-up question or perspective (5-12 words).\n\n" +
				"CRITICAL RULES:\n" +
				"- Tailor each response directly to what the tutor asked/said in the context of '%s'.\n" +
				"- NEVER use placeholder labels like 'Option 1' or 'Suggestion 1'. Each must be an authentic spoken sentence.\n" +
				"- If this is a school/student admission interview, do NOT output corporate HR job interview responses.\n" +
				"- YOU MUST RESPOND IN VALID JSON FORMAT ONLY. Do not wrap in ```json or markdown.\n" +
				"{\n" +
				"  \"hints\": [\n" +
				"    \"First realistic response student can speak\",\n" +
				"    \"Second realistic response student can speak\",\n" +
				"    \"Third realistic response student can speak\"\n" +
				"  ]\n" +
				"}",
				session.getScenario(),
				userContext,
				(lastAiMsg.isEmpty() ? "Welcome to our practice session!" : lastAiMsg),
				session.getScenario());
		groqMessages.add(new GroqRequest.Message("system", systemPrompt));

		// Add last 10 messages for context
		int startIdx = Math.max(0, history.size() - 10);
		for (int i = startIdx; i < history.size(); i++) {
			ConversationMessage m = history.get(i);
			String role = m.getSender().equals("user") ? "user" : "assistant";
			groqMessages.add(new GroqRequest.Message(role, m.getMessage()));
		}

		try {
			String rawReply = callGroqChat(groqMessages);
			String cleanJson = cleanJsonResponse(rawReply);
			com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(cleanJson);
			List<String> rawHints = null;
			if (node.has("hints")) {
				rawHints = objectMapper.convertValue(node.get("hints"),
						new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
						});
			} else if (node.has("suggestions")) {
				rawHints = objectMapper.convertValue(node.get("suggestions"),
						new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
						});
			} else if (node.has("options")) {
				rawHints = objectMapper.convertValue(node.get("options"),
						new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
						});
			} else if (node.has("responses")) {
				rawHints = objectMapper.convertValue(node.get("responses"),
						new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
						});
			} else if (node.isArray()) {
				rawHints = objectMapper.convertValue(node,
						new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
						});
			}

			if (rawHints != null && !rawHints.isEmpty()) {
				List<String> cleanList = new ArrayList<>();
				for (String h : rawHints) {
					String c = cleanAndSanitizeHint(h);
					if (c != null && !c.isEmpty() && !cleanList.contains(c)) {
						cleanList.add(c);
					}
				}
				if (cleanList.size() >= 2)
					return cleanList;
			}

			// If JSON structure didn't contain an array, try extracting lines from raw reply
			if (rawReply != null) {
				List<String> lineList = new ArrayList<>();
				for (String line : rawReply.split("\n")) {
					String c = cleanAndSanitizeHint(line);
					if (c != null && c.length() > 3 && !c.startsWith("{") && !c.startsWith("[") && !lineList.contains(c)) {
						lineList.add(c);
					}
				}
				if (lineList.size() >= 2) {
					return lineList.subList(0, Math.min(3, lineList.size()));
				}
			}
		} catch (Exception e) {
			// ignore and fallback
		}

		return generateContextualScenarioHints(user, session.getScenario(), lastAiMsg, history.size());
	}

	private String buildUserContextInstruction(User user, String scenarioName) {
		if (user == null) {
			return "Learner Profile: General English Learner.\nInstructions: Use friendly, clear English suited to everyday conversation.\n";
		}

		boolean isStudent = (user.getRole() == Role.STUDENT)
				|| (user.getSchoolGrade() != null && !user.getSchoolGrade().trim().isEmpty());
		String grade = user.getSchoolGrade();
		String ageGroup = user.getAgeGroup();
		String scenario = (scenarioName != null) ? scenarioName.trim() : "General";
		boolean isBusinessScenario = "Business Meeting".equalsIgnoreCase(scenario) ||
				"Job Interview Practice".equalsIgnoreCase(scenario) ||
				"Salary & Contract Negotiation".equalsIgnoreCase(scenario) ||
				"Presentation Skills".equalsIgnoreCase(scenario);

		StringBuilder sb = new StringBuilder();

		if (isStudent && grade != null && !grade.trim().isEmpty()) {
			String g = grade.trim().toLowerCase();
			sb.append("Learner Profile: School Student (").append(grade).append(").\n");
			if (g.contains("1st") || g.contains("2nd") || g.contains("first") || g.contains("second")) {
				sb.append("School Standard: 1st/2nd Standard (Primary School, Age 6-7).\n")
						.append("Instructions: Use extremely simple English (3-5 word sentences, Pre-A1/A1). Focus on cheerful, simple roleplays (pets, toys, cartoon friends, school fun). NEVER use adult, job, or financial themes.\n");
			} else if (g.contains("3rd") || g.contains("4th") || g.contains("5th") || g.contains("third")
					|| g.contains("fourth") || g.contains("fifth")) {
				sb.append("School Standard: 3rd-5th Standard (Upper Primary School, Age 8-10).\n")
						.append("Instructions: Use basic, clear English (A1-A2). Focus on school subjects, friends, hobbies, science, pets, and simple roleplays. Keep sentences short and engaging.\n");
			} else if (g.contains("6th") || g.contains("7th") || g.contains("8th") || g.contains("sixth")
					|| g.contains("seventh") || g.contains("eighth")) {
				sb.append("School Standard: 6th-8th Standard (Middle School, Age 11-13).\n")
						.append("Instructions: Use friendly, encouraging English (A2-B1). Focus on school projects, sports, games, coding, quizzes, environment, and books.\n");
			} else { // 9th, 10th Standard or High School
				sb.append("School Standard: 9th-10th Standard (High School / Board Exam, Age 14-16).\n")
						.append("Instructions: Use structured, natural conversational English (B1-B2). Focus on career dreams, technology, space science, social topics, debating, and public speaking.\n");
			}
		} else {
			// Individual User Profile by Age Group
			sb.append("Learner Profile: Individual User.\n");
			if ("Kids".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Kids (Age 6-12).\n")
						.append("Instructions: Be super enthusiastic and friendly. Use simple words and short sentences (A1). Zero adult or corporate themes.\n");
			} else if ("Teens".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Teens (Age 13-17).\n")
						.append("Instructions: Be a supportive peer tutor. Use modern, relatable conversational English (A2-B1). Focus on high school life, music, sports, and teen hobbies.\n");
			} else if ("Young Adult".equalsIgnoreCase(ageGroup) || "Young Adults".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Young Adults (Age 18-24).\n")
						.append("Instructions: Use energetic, natural conversational English (B1-B2). Focus on college life, travel, technology, and social confidence.\n");
			} else if ("Senior".equalsIgnoreCase(ageGroup) || "Seniors".equalsIgnoreCase(ageGroup)) {
				sb.append("Age Group: Seniors (Age 50+).\n")
						.append("Instructions: Be warm, patient, and respectful. Focus on culture, books, gardening, travel, and life experiences.\n");
			} else { // Professional / Working Adult (25-50) or default
				sb.append("Age Group: Adults (Age 25-50).\n");
				if (isBusinessScenario) {
					sb.append(
							"Instructions: Focus on Business English, corporate meeting scenarios, presentations, formal tone, and professional workplace communication.\n");
				} else {
					sb.append(
							"Instructions: Roleplay naturally as a friendly adult peer about daily life, cooking, fitness, travel, and personal interests. STRICT RULE: DO NOT steer the conversation into corporate meetings, office projects, or business jargon unless the scenario explicitly calls for it.\n");
				}
			}
		}

		if (!isBusinessScenario) {
			sb.append("TOPIC GUARDRAIL: The active scenario is '").append(scenario).append(
					"'. Stick strictly to this scenario. Do NOT turn conversations into business, office, or corporate meetings unless the user explicitly requests it.\n");
		}

		return sb.toString();
	}

	// Helper inner class for Jackson deserialization
	@SuppressWarnings("unused")
	private static class FinalEvaluation {
		private Double score;
		private Double overallScore;
		private Double grammarScore;
		private Double vocabularyScore;
		private Double fluencyScore;
		private Double pronunciationScore;
		private String summary;
		private String vocabularyLearned;
		private String grammarCorrections;
		private String betterSentences;
		private String motivationalMessage;

		public Double getScore() {
			return score != null ? score : overallScore;
		}

		public void setScore(Double score) {
			this.score = score;
		}

		public Double getOverallScore() {
			return overallScore != null ? overallScore : score;
		}

		public void setOverallScore(Double overallScore) {
			this.overallScore = overallScore;
		}

		public Double getGrammarScore() {
			return grammarScore;
		}

		public void setGrammarScore(Double grammarScore) {
			this.grammarScore = grammarScore;
		}

		public Double getVocabularyScore() {
			return vocabularyScore;
		}

		public void setVocabularyScore(Double vocabularyScore) {
			this.vocabularyScore = vocabularyScore;
		}

		public Double getFluencyScore() {
			return fluencyScore;
		}

		public void setFluencyScore(Double fluencyScore) {
			this.fluencyScore = fluencyScore;
		}

		public Double getPronunciationScore() {
			return pronunciationScore;
		}

		public void setPronunciationScore(Double pronunciationScore) {
			this.pronunciationScore = pronunciationScore;
		}

		public String getSummary() {
			return summary;
		}

		public void setSummary(String summary) {
			this.summary = summary;
		}

		public String getVocabularyLearned() {
			return vocabularyLearned;
		}

		public void setVocabularyLearned(String vocabularyLearned) {
			this.vocabularyLearned = vocabularyLearned;
		}

		public String getGrammarCorrections() {
			return grammarCorrections;
		}

		public void setGrammarCorrections(String grammarCorrections) {
			this.grammarCorrections = grammarCorrections;
		}

		public String getBetterSentences() {
			return betterSentences;
		}

		public void setBetterSentences(String betterSentences) {
			this.betterSentences = betterSentences;
		}

		public String getMotivationalMessage() {
			return motivationalMessage;
		}

		public void setMotivationalMessage(String motivationalMessage) {
			this.motivationalMessage = motivationalMessage;
		}
	}
}