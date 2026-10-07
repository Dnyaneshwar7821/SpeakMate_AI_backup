package com.rslsolution.speakmateai.service.impl;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.SettingsRequest;
import com.rslsolution.speakmateai.dto.response.SettingsResponse;
import com.rslsolution.speakmateai.entity.Settings;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.exception.SettingsNotFoundException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.SettingsRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.SettingsService;

@Service
@Transactional
public class SettingsServiceImpl implements SettingsService {

	private final SettingsRepository settingsRepository;
	private final UserRepository userRepository;

	public SettingsServiceImpl(SettingsRepository settingsRepository, UserRepository userRepository) {
		this.settingsRepository = settingsRepository;
		this.userRepository = userRepository;
	}

	@Override
	public SettingsResponse createSettings(SettingsRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Settings settings = Settings.builder().user(user).darkMode(request.getDarkMode())
				.notificationsEnabled(request.getNotificationsEnabled()).language(request.getLanguage())
				.aiVoice(request.getAiVoice()).soundEffects(request.getSoundEffects())
				.autoPlayAudio(request.getAutoPlayAudio()).dailyReminder(request.getDailyReminder()).build();

		Settings savedSettings = settingsRepository.save(settings);

		return mapToResponse(savedSettings);
	}

	@Override
	public SettingsResponse getSettings() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Settings settings = settingsRepository.findByUser(user)
				.orElseGet(() -> {
					Settings newSettings = Settings.builder()
							.user(user)
							.build();
					return settingsRepository.save(newSettings);
				});

		return mapToResponse(settings);
	}

	@Override
	public SettingsResponse updateSettings(SettingsRequest request) {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Settings settings = settingsRepository.findByUser(user)
				.orElseGet(() -> {
					Settings newSettings = Settings.builder()
							.user(user)
							.build();
					return settingsRepository.save(newSettings);
				});

		settings.setDarkMode(request.getDarkMode() != null ? request.getDarkMode() : settings.getDarkMode());
		settings.setNotificationsEnabled(request.getNotificationsEnabled() != null ? request.getNotificationsEnabled() : settings.getNotificationsEnabled());
		if (request.getLanguage() != null && !request.getLanguage().isBlank()) {
			settings.setLanguage(request.getLanguage());
		}
		if (request.getAiVoice() != null && !request.getAiVoice().isBlank()) {
			settings.setAiVoice(request.getAiVoice());
			user.setPreferredVoice(request.getAiVoice());
			userRepository.save(user);
		}
		settings.setSoundEffects(request.getSoundEffects() != null ? request.getSoundEffects() : settings.getSoundEffects());
		settings.setAutoPlayAudio(request.getAutoPlayAudio() != null ? request.getAutoPlayAudio() : settings.getAutoPlayAudio());
		settings.setDailyReminder(request.getDailyReminder() != null ? request.getDailyReminder() : settings.getDailyReminder());

		Settings updatedSettings = settingsRepository.save(settings);

		return mapToResponse(updatedSettings);
	}

	@Override
	public void deleteSettings() {

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		User user = userRepository.findByEmail(authentication.getName())
				.orElseThrow(() -> new UserNotFoundException("User not found"));

		Settings settings = settingsRepository.findByUser(user)
				.orElseThrow(() -> new SettingsNotFoundException("Settings not found"));

		settingsRepository.delete(settings);
	}

	private SettingsResponse mapToResponse(Settings settings) {

		return SettingsResponse.builder().id(settings.getId()).darkMode(settings.getDarkMode())
				.notificationsEnabled(settings.getNotificationsEnabled()).language(settings.getLanguage())
				.aiVoice(settings.getAiVoice()).soundEffects(settings.getSoundEffects())
				.autoPlayAudio(settings.getAutoPlayAudio()).dailyReminder(settings.getDailyReminder())
				.createdAt(settings.getCreatedAt()).updatedAt(settings.getUpdatedAt()).build();
	}
}