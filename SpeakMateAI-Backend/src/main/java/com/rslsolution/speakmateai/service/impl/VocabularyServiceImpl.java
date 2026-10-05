package com.rslsolution.speakmateai.service.impl;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.VocabularyRequest;
import com.rslsolution.speakmateai.dto.response.VocabularyResponse;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.entity.Vocabulary;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.exception.VocabularyNotFoundException;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.repository.VocabularyRepository;
import com.rslsolution.speakmateai.service.VocabularyService;

@Service
@Transactional
public class VocabularyServiceImpl implements VocabularyService {

	private final VocabularyRepository vocabularyRepository;
	private final UserRepository userRepository;
	private final com.rslsolution.speakmateai.repository.ProgressRepository progressRepository;
	private final com.rslsolution.speakmateai.service.AiService aiService;
	private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

	public VocabularyServiceImpl(VocabularyRepository vocabularyRepository, UserRepository userRepository,
			com.rslsolution.speakmateai.repository.ProgressRepository progressRepository,
			com.rslsolution.speakmateai.service.AiService aiService, com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
		this.vocabularyRepository = vocabularyRepository;
		this.userRepository = userRepository;
		this.progressRepository = progressRepository;
		this.aiService = aiService;
		this.objectMapper = objectMapper;
	}

	private String extractJson(String text) {
		if (text == null) return "{}";
		int start = text.indexOf("{");
		int end = text.lastIndexOf("}");
		if (start != -1 && end != -1 && end > start) {
			return text.substring(start, end + 1);
		}
		return text;
	}

	@Override
	public VocabularyResponse addVocabulary(VocabularyRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		String rawWord = request.getWord();
		if (rawWord == null || rawWord.trim().isEmpty()) {
			throw new IllegalArgumentException("Vocabulary word cannot be empty.");
		}
		String word = rawWord.trim();

		// 1. Strict Duplicate Check: Never save duplicates or award XP
		if (vocabularyRepository.existsByUserAndWordIgnoreCase(user, word)) {
			throw new IllegalArgumentException("\"" + word + "\" is already in your vocabulary list.");
		}

		// 2. Strict English Word Format & Lexical Validation
		if (!word.matches("^[A-Za-z]+([ -][A-Za-z]+)*$") || word.length() < 2 || word.length() > 45) {
			throw new IllegalArgumentException("\"" + word + "\" is not a valid English word. SpeakMate AI accepts valid English words only (letters only, no numbers or special symbols).");
		}

		// Reject repeated character mashing (e.g. "aaaa", "zzzz")
		if (word.matches(".*([A-Za-z])\\1{3,}.*")) {
			throw new IllegalArgumentException("\"" + word + "\" appears to be random keyboard mashing. Please enter a valid English vocabulary word.");
		}

		String meaning = null;
		String exampleSentence = null;
		String synonym = "";
		String antonym = "";
		String phonetic = "";
		String partOfSpeech = "noun";
		String collocations = "";
		String level = "Intermediate";

		try {
			String prompt = "You are a strict English lexicographer and language tutor for SpeakMate AI.\n"
					+ "Evaluate the word or phrase: \"" + word + "\".\n"
					+ "Rule 1: If \"" + word + "\" is NOT a valid, recognized English dictionary word or idiomatic English term (e.g. if it belongs to another language like French, Spanish, Hindi, German, etc., or if it is meaningless gibberish/slang), respond ONLY with this JSON:\n"
					+ "{\n"
					+ "  \"error\": \"The word '" + word + "' is not recognized as a valid English vocabulary word. SpeakMate AI is dedicated to English language fluency. Please enter a valid English word.\"\n"
					+ "}\n\n"
					+ "Rule 2: If \"" + word + "\" IS a recognized English word, respond ONLY with this JSON:\n"
					+ "{\n"
					+ "  \"meaning\": \"Clear, accurate definition in English\",\n"
					+ "  \"phonetic\": \"IPA phonetic notation e.g. /ˈel.ə.kwənt/\",\n"
					+ "  \"partOfSpeech\": \"noun / verb / adjective / adverb / idiom\",\n"
					+ "  \"synonyms\": \"Comma-separated English synonyms\",\n"
					+ "  \"antonyms\": \"Comma-separated English antonyms\",\n"
					+ "  \"collocations\": \"Common natural word pairings e.g. eloquent speaker, articulate defense\",\n"
					+ "  \"level\": \"Beginner / Intermediate / Advanced\",\n"
					+ "  \"exampleSentence\": \"A natural conversational example sentence demonstrating the word in English.\"\n"
					+ "}\n"
					+ "Respond ONLY with the JSON block. Do not include markdown codeblocks or conversational prefix/suffix.";

			com.rslsolution.speakmateai.dto.request.AiRequest aiRequest = com.rslsolution.speakmateai.dto.request.AiRequest.builder().prompt(prompt).build();
			com.rslsolution.speakmateai.dto.response.AiResponse aiResponse = aiService.vocabularyAssistant(aiRequest);
			
			String rawResponse = aiResponse.getResponse();
			String jsonStr = extractJson(rawResponse);
			
			java.util.Map<String, String> data = objectMapper.readValue(jsonStr, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, String>>() {});
			if (data.containsKey("error") && data.get("error") != null && !data.get("error").isBlank()) {
				throw new IllegalArgumentException(data.get("error"));
			}
			if (data.containsKey("meaning") && !data.get("meaning").isBlank()) meaning = data.get("meaning");
			if (data.containsKey("exampleSentence") && !data.get("exampleSentence").isBlank()) exampleSentence = data.get("exampleSentence");
			if (data.containsKey("synonyms")) synonym = data.get("synonyms");
			if (data.containsKey("antonyms")) antonym = data.get("antonyms");
			if (data.containsKey("phonetic")) phonetic = data.get("phonetic");
			if (data.containsKey("partOfSpeech")) partOfSpeech = data.get("partOfSpeech");
			if (data.containsKey("collocations")) collocations = data.get("collocations");
			if (data.containsKey("level")) level = data.get("level");
		} catch (IllegalArgumentException iae) {
			throw iae;
		} catch (Exception e) {
			throw new IllegalArgumentException("\"" + word + "\" is not recognized as a valid English vocabulary word. SpeakMate AI accepts valid English words only.");
		}

		if (meaning == null || meaning.isBlank()) {
			throw new IllegalArgumentException("Could not verify \"" + word + "\" as a valid English vocabulary word.");
		}

		Vocabulary vocabulary = Vocabulary.builder()
				.user(user)
				.word(word)
				.meaning(meaning)
				.exampleSentence(exampleSentence)
				.synonym(synonym)
				.antonym(antonym)
				.phonetic(phonetic)
				.partOfSpeech(partOfSpeech)
				.collocations(collocations)
				.level(level)
				.favorite(false)
				.mastered(false)
				.build();

		Vocabulary savedVocabulary = vocabularyRepository.save(vocabulary);

		// Increment Vocabulary progress count & award XP
		try {
			com.rslsolution.speakmateai.entity.Progress progress = progressRepository.findByUser(user)
					.orElseGet(() -> com.rslsolution.speakmateai.entity.Progress.builder().user(user).xp(0).level(1).currentStreak(0).longestStreak(0).totalPracticeMinutes(0).totalSpeakingSessions(0).totalGrammarChecks(0).totalVocabularyWords(0).build());
			int newXp = (progress.getXp() == null ? 0 : progress.getXp()) + 5;
			progress.setXp(newXp);
			int newVocabCount = (progress.getTotalVocabularyWords() == null ? 0 : progress.getTotalVocabularyWords()) + 1;
			progress.setTotalVocabularyWords(newVocabCount);
			progress.setLevel(Math.max(1, (newXp / 500) + 1));
			progressRepository.save(progress);
		} catch (Exception ex) {
			// Ignore progress update errors
		}

		return mapToResponse(savedVocabulary);
	}

	@Override
	public List<VocabularyResponse> getAllVocabulary() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		return vocabularyRepository.findByUserOrderByCreatedAtDesc(user).stream()
				.map(this::mapToResponse)
				.toList();
	}

	@Override
	public VocabularyResponse getVocabularyById(Long id) {

		Vocabulary vocabulary = vocabularyRepository.findById(id)
				.orElseThrow(() -> new VocabularyNotFoundException("Vocabulary not found"));

		return mapToResponse(vocabulary);
	}

	@Override
	public List<VocabularyResponse> getFavoriteVocabulary() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		return vocabularyRepository.findByUserAndFavoriteTrue(user).stream()
				.map(this::mapToResponse)
				.toList();
	}

	@Override
	public void deleteVocabularyById(Long id) {

		Vocabulary vocabulary = vocabularyRepository.findById(id)
				.orElseThrow(() -> new VocabularyNotFoundException("Vocabulary not found"));

		vocabularyRepository.delete(vocabulary);
	}

	@Override
	public VocabularyResponse toggleFavorite(Long id) {
		Vocabulary vocabulary = vocabularyRepository.findById(id)
				.orElseThrow(() -> new VocabularyNotFoundException("Vocabulary not found"));
		vocabulary.setFavorite(!Boolean.TRUE.equals(vocabulary.getFavorite()));
		Vocabulary saved = vocabularyRepository.save(vocabulary);
		return mapToResponse(saved);
	}

	@Override
	public VocabularyResponse toggleMastered(Long id) {
		Vocabulary vocabulary = vocabularyRepository.findById(id)
				.orElseThrow(() -> new VocabularyNotFoundException("Vocabulary not found"));
		boolean newMastered = !Boolean.TRUE.equals(vocabulary.getMastered());
		vocabulary.setMastered(newMastered);
		Vocabulary saved = vocabularyRepository.save(vocabulary);

		// Mastering a word does not award XP (0 XP; adding a word awards 5 XP)
		return mapToResponse(saved);
	}

	private VocabularyResponse mapToResponse(Vocabulary v) {
		return VocabularyResponse.builder()
				.id(v.getId())
				.word(v.getWord())
				.meaning(v.getMeaning())
				.exampleSentence(v.getExampleSentence())
				.synonym(v.getSynonym())
				.antonym(v.getAntonym())
				.phonetic(v.getPhonetic())
				.partOfSpeech(v.getPartOfSpeech())
				.collocations(v.getCollocations())
				.level(v.getLevel())
				.favorite(v.getFavorite())
				.mastered(v.getMastered())
				.createdAt(v.getCreatedAt())
				.build();
	}

	@Override
	public List<java.util.Map<String, Object>> getQuiz() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		List<Vocabulary> userWords = vocabularyRepository.findByUserOrderByCreatedAtDesc(user);
		
		List<java.util.Map<String, String>> fallbackList = List.of(
			java.util.Map.of("word", "articulate", "meaning", "Expressing oneself clearly and effectively."),
			java.util.Map.of("word", "eloquent", "meaning", "Fluent or persuasive in speaking or writing."),
			java.util.Map.of("word", "ubiquitous", "meaning", "Present, appearing, or found everywhere."),
			java.util.Map.of("word", "pragmatic", "meaning", "Dealing with things sensibly and realistically."),
			java.util.Map.of("word", "ephemeral", "meaning", "Lasting for a very short time.")
		);

		List<java.util.Map<String, Object>> quizQuestions = new java.util.ArrayList<>();
		
		int wordCount = Math.max(userWords.size(), fallbackList.size());
		for (int i = 0; i < Math.min(5, wordCount); i++) {
			String currentWord;
			String correctMeaning;
			
			if (i < userWords.size()) {
				currentWord = userWords.get(i).getWord();
				correctMeaning = userWords.get(i).getMeaning();
			} else {
				currentWord = fallbackList.get(i % fallbackList.size()).get("word");
				correctMeaning = fallbackList.get(i % fallbackList.size()).get("meaning");
			}

			List<String> options = new java.util.ArrayList<>();
			options.add(correctMeaning);

			java.util.Set<String> distractors = new java.util.HashSet<>();
			for (Vocabulary v : userWords) {
				if (!v.getWord().equalsIgnoreCase(currentWord) && v.getMeaning() != null && !v.getMeaning().isEmpty()) {
					distractors.add(v.getMeaning());
				}
			}
			for (java.util.Map<String, String> f : fallbackList) {
				if (!f.get("word").equalsIgnoreCase(currentWord)) {
					distractors.add(f.get("meaning"));
				}
			}
			
			List<String> distractorList = new java.util.ArrayList<>(distractors);
			java.util.Collections.shuffle(distractorList);
			for (String d : distractorList) {
				if (options.size() < 4) {
					options.add(d);
				}
			}
			
			java.util.Collections.shuffle(options);
			
			java.util.Map<String, Object> question = new java.util.HashMap<>();
			question.put("word", currentWord);
			question.put("correctAnswer", correctMeaning);
			question.put("options", options);
			
			quizQuestions.add(question);
		}
		
		return quizQuestions;
	}
}