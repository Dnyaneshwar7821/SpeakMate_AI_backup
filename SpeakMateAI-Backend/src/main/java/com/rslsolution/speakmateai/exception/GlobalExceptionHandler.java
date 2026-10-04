package com.rslsolution.speakmateai.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private void logException(String handlerName, Exception ex) {
		logger.error("[EXCEPTION LOG] Handled by {}: {}", handlerName, ex.getMessage(), ex);
	}

	@ExceptionHandler(DuplicateEmailException.class)
	public ResponseEntity<Map<String, Object>> handleDuplicateEmail(DuplicateEmailException ex) {
		logException("handleDuplicateEmail", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.CONFLICT.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.CONFLICT);
	}

	@ExceptionHandler(UserNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleUserNotFound(UserNotFoundException ex) {
		logException("handleUserNotFound", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(ChatNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleChatNotFound(ChatNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(SpeakingSessionNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleSpeakingSessionNotFound(SpeakingSessionNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(GrammarNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleGrammarNotFound(GrammarNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(VocabularyNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleVocabularyNotFound(VocabularyNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(ProgressNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleProgressNotFound(ProgressNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(AchievementNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleAchievementNotFound(AchievementNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(NotificationNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotificationNotFound(NotificationNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(SettingsNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleSettingsNotFound(SettingsNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(OnboardingNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleOnboardingNotFound(OnboardingNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(LessonNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleLessonNotFound(LessonNotFoundException ex) {

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(GroqException.class)
	public ResponseEntity<Map<String, Object>> handleGroqException(GroqException ex) {

		Map<String, Object> response = new HashMap<>();

		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
	}

	@ExceptionHandler(SpeechException.class)
	public ResponseEntity<Map<String, Object>> handleSpeechException(SpeechException ex) {

		Map<String, Object> response = new HashMap<>();

		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
		logException("handleInvalidCredentials", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.UNAUTHORIZED.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
		logException("handleValidation", ex);

		Map<String, String> errors = new HashMap<>();

		ex.getBindingResult().getFieldErrors()
				.forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));

		return new ResponseEntity<>(errors, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
		logException("handleIllegalArgument", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.BAD_REQUEST.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
	public ResponseEntity<Map<String, Object>> handleTypeMismatch(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
		logException("handleTypeMismatch", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.BAD_REQUEST.value());
		response.put("message", "Invalid parameter: " + ex.getName() + " value '" + ex.getValue() + "'");

		return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
		logException("handleDataIntegrity", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.BAD_REQUEST.value());
		response.put("message", "Data integrity violation: " + ex.getMostSpecificCause().getMessage());

		return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler({ AccessDeniedException.class, org.springframework.security.access.AccessDeniedException.class })
	public ResponseEntity<Map<String, Object>> handleAccessDenied(Exception ex) {
		logException("handleAccessDenied", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("success", false);
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.FORBIDDEN.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
	}

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {
		logException("handleResourceNotFound", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("success", false);
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(DuplicateAssignmentException.class)
	public ResponseEntity<Map<String, Object>> handleDuplicateAssignment(DuplicateAssignmentException ex) {
		logException("handleDuplicateAssignment", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("success", false);
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.CONFLICT.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.CONFLICT);
	}

	@ExceptionHandler({
		org.springframework.web.servlet.resource.NoResourceFoundException.class,
		org.springframework.web.servlet.NoHandlerFoundException.class
	})
	public ResponseEntity<Map<String, Object>> handleNoResourceFound(Exception ex) {
		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.NOT_FOUND.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
		logException("handleIllegalArgumentException", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.BAD_REQUEST.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
		logException("handleException", ex);

		Map<String, Object> response = new HashMap<>();
		response.put("timestamp", LocalDateTime.now());
		response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
		response.put("message", ex.getMessage());

		return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
	}
}