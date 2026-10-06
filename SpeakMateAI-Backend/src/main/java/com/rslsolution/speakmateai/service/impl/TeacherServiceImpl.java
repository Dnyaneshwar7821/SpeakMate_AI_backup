package com.rslsolution.speakmateai.service.impl;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.response.AchievementResponse;
import com.rslsolution.speakmateai.dto.response.AiLearningInsightResponse;
import com.rslsolution.speakmateai.dto.response.AssignedClassResponse;
import com.rslsolution.speakmateai.dto.response.ClassPerformanceResponse;
import com.rslsolution.speakmateai.dto.response.PerformanceSummaryResponse;
import com.rslsolution.speakmateai.dto.response.PerformanceTrendResponse;
import com.rslsolution.speakmateai.dto.response.PracticeStatisticsResponse;
import com.rslsolution.speakmateai.dto.response.ProfileResponse;
import com.rslsolution.speakmateai.dto.response.RecentActivityResponse;
import com.rslsolution.speakmateai.dto.response.ReportCategoryResponse;
import com.rslsolution.speakmateai.dto.response.RecentReportResponse;
import com.rslsolution.speakmateai.dto.response.ReportStatusResponse;
import com.rslsolution.speakmateai.dto.response.SkillPerformanceSummaryResponse;
import com.rslsolution.speakmateai.dto.response.StrengthImprovementResponse;
import com.rslsolution.speakmateai.dto.response.StudentAttentionItemResponse;
import com.rslsolution.speakmateai.dto.response.StudentAnalyticsSummaryResponse;
import com.rslsolution.speakmateai.dto.response.TeacherAnalyticsResponse;
import com.rslsolution.speakmateai.dto.response.TeacherDashboardResponse;
import com.rslsolution.speakmateai.dto.response.TeacherProfileResponse;
import com.rslsolution.speakmateai.dto.response.TeacherReportsResponse;
import com.rslsolution.speakmateai.dto.response.TeacherStudentDetailResponse;
import com.rslsolution.speakmateai.dto.response.TeacherStudentSummaryResponse;
import com.rslsolution.speakmateai.dto.response.TeacherStudentsListResponse;
import com.rslsolution.speakmateai.dto.response.TopPerformerResponse;
import com.rslsolution.speakmateai.dto.response.UpcomingReportResponse;
import com.rslsolution.speakmateai.dto.response.WeeklyProgressResponse;
import com.rslsolution.speakmateai.dto.response.StatisticsResponse;
import com.rslsolution.speakmateai.dto.response.AcademicSessionResponse;
import com.rslsolution.speakmateai.dto.response.IdentityResponse;
import com.rslsolution.speakmateai.dto.response.ProfessionalInfoResponse;
import com.rslsolution.speakmateai.dto.response.TeachingOverviewResponse;
import com.rslsolution.speakmateai.dto.response.ContactInfoResponse;
import com.rslsolution.speakmateai.dto.response.AccountInfoResponse;
import com.rslsolution.speakmateai.dto.response.UserPreferencesResponse;
import com.rslsolution.speakmateai.entity.Achievement;
import com.rslsolution.speakmateai.entity.Admin;
import com.rslsolution.speakmateai.entity.ClassRoom;
import com.rslsolution.speakmateai.entity.ClassStudent;
import com.rslsolution.speakmateai.entity.GrammarHistory;
import com.rslsolution.speakmateai.entity.LessonProgress;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.entity.SpeakingSession;
import com.rslsolution.speakmateai.entity.Student;
import com.rslsolution.speakmateai.entity.TeacherStandardDivision;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.entity.School;
import com.rslsolution.speakmateai.entity.Vocabulary;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.enums.Status;
import com.rslsolution.speakmateai.exception.AccessDeniedException;
import com.rslsolution.speakmateai.exception.ResourceNotFoundException;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.AchievementRepository;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.repository.ClassRoomRepository;
import com.rslsolution.speakmateai.repository.ClassStudentRepository;
import com.rslsolution.speakmateai.repository.GrammarHistoryRepository;
import com.rslsolution.speakmateai.repository.LessonProgressRepository;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.SchoolRepository;
import com.rslsolution.speakmateai.repository.SettingsRepository;
import com.rslsolution.speakmateai.repository.SpeakingSessionRepository;
import com.rslsolution.speakmateai.repository.StudentRepository;
import com.rslsolution.speakmateai.repository.TeacherRepository;
import com.rslsolution.speakmateai.repository.TeacherStandardDivisionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.dto.response.SpeakingSessionDetailResponse;
import com.rslsolution.speakmateai.entity.ConversationFeedback;
import com.rslsolution.speakmateai.repository.ConversationFeedbackRepository;
import com.rslsolution.speakmateai.repository.VocabularyRepository;
import com.rslsolution.speakmateai.service.TeacherService;
import com.rslsolution.speakmateai.dto.request.ChangePasswordRequest;
import com.rslsolution.speakmateai.dto.request.TeacherProfileUpdateRequest;
import com.rslsolution.speakmateai.entity.Teacher;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@Transactional
@SuppressWarnings("unused")
public class TeacherServiceImpl implements TeacherService {

	private final UserRepository userRepository;
	private final TeacherRepository teacherRepository;
	private final PasswordEncoder passwordEncoder;
	private final StudentRepository studentRepository;
	private final AdminRepository adminRepository;
	private final ClassRoomRepository classRoomRepository;
	private final ClassStudentRepository classStudentRepository;
	private final TeacherStandardDivisionRepository teacherStandardDivisionRepository;
	private final ProgressRepository progressRepository;
	private final SpeakingSessionRepository speakingSessionRepository;
	private final GrammarHistoryRepository grammarHistoryRepository;
	private final VocabularyRepository vocabularyRepository;
	private final LessonProgressRepository lessonProgressRepository;
	private final AchievementRepository achievementRepository;
	private final SettingsRepository settingsRepository;
	private final SchoolRepository schoolRepository;

	@org.springframework.beans.factory.annotation.Autowired(required = false)
	private ConversationFeedbackRepository conversationFeedbackRepository;

	private static class CachedDashboard {
		final long timestamp;
		final TeacherDashboardResponse data;

		CachedDashboard(long timestamp, TeacherDashboardResponse data) {
			this.timestamp = timestamp;
			this.data = data;
		}
	}

	private final Map<Long, CachedDashboard> teacherDashboardCache = new ConcurrentHashMap<>();

	@org.springframework.beans.factory.annotation.Autowired
	public TeacherServiceImpl(UserRepository userRepository, TeacherRepository teacherRepository,
			PasswordEncoder passwordEncoder, StudentRepository studentRepository,
			AdminRepository adminRepository, ClassRoomRepository classRoomRepository,
			ClassStudentRepository classStudentRepository,
			TeacherStandardDivisionRepository teacherStandardDivisionRepository,
			ProgressRepository progressRepository, SpeakingSessionRepository speakingSessionRepository,
			GrammarHistoryRepository grammarHistoryRepository, VocabularyRepository vocabularyRepository,
			LessonProgressRepository lessonProgressRepository, AchievementRepository achievementRepository,
			SettingsRepository settingsRepository,
			SchoolRepository schoolRepository) {
		this.userRepository = userRepository;
		this.teacherRepository = teacherRepository;
		this.passwordEncoder = passwordEncoder;
		this.studentRepository = studentRepository;
		this.adminRepository = adminRepository;
		this.classRoomRepository = classRoomRepository;
		this.classStudentRepository = classStudentRepository;
		this.teacherStandardDivisionRepository = teacherStandardDivisionRepository;
		this.progressRepository = progressRepository;
		this.speakingSessionRepository = speakingSessionRepository;
		this.grammarHistoryRepository = grammarHistoryRepository;
		this.vocabularyRepository = vocabularyRepository;
		this.lessonProgressRepository = lessonProgressRepository;
		this.achievementRepository = achievementRepository;
		this.settingsRepository = settingsRepository;
		this.schoolRepository = schoolRepository;
	}

	private Teacher getAuthenticatedTeacher() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null) {
			throw new UserNotFoundException("Authentication required");
		}
		String email = authentication.getName();

		Teacher teacher = teacherRepository.findByEmail(email).orElse(null);
		if (teacher != null) {
			return teacher;
		}

		User user = userRepository.findByEmail(email).orElse(null);
		if (user != null) {
			if (user instanceof Teacher) {
				return (Teacher) user;
			}
			if (user.getId() != null) {
				Teacher t = teacherRepository.findById(user.getId()).orElse(null);
				if (t != null) {
					return t;
				}
			}
			if (user.getRole() == Role.TEACHER) {
				Teacher t = Teacher.builder()
						.id(user.getId())
						.email(user.getEmail())
						.firstName(user.getFirstName())
						.lastName(user.getLastName())
						.password(user.getPassword())
						.role(user.getRole())
						.schoolId(user.getSchoolId())
						.phone(user.getPhone())
						.active(user.isActive())
						.userType(user.getUserType())
						.status(user.getStatus())
						.standard(user.getStandard())
						.division(user.getDivision())
						.createdAt(user.getCreatedAt())
						.updatedAt(user.getUpdatedAt())
						.build();
				return teacherRepository.save(t);
			}
			if (user.getSchoolId() != null) {
				List<Teacher> schoolTeachers = teacherRepository.findBySchoolId(user.getSchoolId());
				if (!schoolTeachers.isEmpty()) {
					return schoolTeachers.get(0);
				}
			}
		}

		Admin admin = adminRepository.findByEmail(email).orElse(null);
		if (admin != null) {
			java.util.Optional<Teacher> anyTeacher = teacherRepository.findAll().stream().findFirst();
			if (anyTeacher.isPresent()) {
				return anyTeacher.get();
			}
		}

		java.util.Optional<Teacher> anyTeacher = teacherRepository.findAll().stream().findFirst();
		if (anyTeacher.isPresent()) {
			return anyTeacher.get();
		}

		throw new UserNotFoundException("Teacher not found");
	}

	private User getCurrentTeacher() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null) {
			throw new UserNotFoundException("Authentication required");
		}
		String email = authentication.getName();

		User user = userRepository.findByEmail(email).orElse(null);
		if (user != null) {
			if (user.getRole() == Role.TEACHER) {
				return user;
			}
			if (user.getSchoolId() != null) {
				List<Teacher> schoolTeachers = teacherRepository.findBySchoolId(user.getSchoolId());
				if (!schoolTeachers.isEmpty()) {
					return schoolTeachers.get(0);
				}
			}
			java.util.Optional<Teacher> anyTeacher = teacherRepository.findAll().stream().findFirst();
			if (anyTeacher.isPresent()) {
				return anyTeacher.get();
			}
			return user;
		}

		Admin admin = adminRepository.findByEmail(email).orElse(null);
		if (admin != null) {
			java.util.Optional<Teacher> anyTeacher = teacherRepository.findAll().stream().findFirst();
			if (anyTeacher.isPresent()) {
				return anyTeacher.get();
			}
		}

		throw new UserNotFoundException("Teacher not found");
	}

	private List<ClassRoom> getTeacherClasses(Long teacherId) {
		List<ClassRoom> rooms = classRoomRepository.findByTeacherId(teacherId);
		if (teacherStandardDivisionRepository != null && teacherId != null) {
			List<TeacherStandardDivision> tsds = teacherStandardDivisionRepository.findByTeacherId(teacherId);
			if (tsds != null && !tsds.isEmpty()) {
				java.util.Set<String> assignedKeys = tsds.stream()
						.filter(tsd -> tsd.getStandardDivision() != null && tsd.getStandardDivision().getSchoolStandard() != null)
						.map(tsd -> normalizeStandard(tsd.getStandardDivision().getSchoolStandard().getStandard()) + "-"
								+ (tsd.getStandardDivision().getDivision() != null ? tsd.getStandardDivision().getDivision().trim().toUpperCase() : ""))
						.collect(Collectors.toSet());
				Map<String, ClassRoom> deduped = new LinkedHashMap<>();
				for (ClassRoom r : rooms) {
					String key = normalizeStandard(r.getGrade()) + "-" + (r.getDivision() != null ? r.getDivision().trim().toUpperCase() : "");
					if (assignedKeys.contains(key) && !deduped.containsKey(key)) {
						deduped.put(key, r);
					}
				}
				return new ArrayList<>(deduped.values());
			}
		}
		return rooms;
	}

	private String normalizeStandard(String val) {
		if (val == null) return "";
		String trimmed = val.trim();
		java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(trimmed);
		if (m.find()) {
			return m.group();
		}
		return trimmed.toLowerCase();
	}

	private List<User> getTeacherStudents(User teacher, List<ClassRoom> classes) {
		java.util.Map<Long, User> studentMap = new java.util.LinkedHashMap<>();

		// 1. Students directly assigned via Student.teacherId
		if (teacher != null && teacher.getId() != null) {
			List<Student> directAssigned = studentRepository.findByTeacherId(teacher.getId());
			for (Student s : directAssigned) {
				if (s != null && s.getId() != null && s.getRole() == Role.STUDENT) {
					studentMap.putIfAbsent(s.getId(), s);
				}
			}
		}

		// 2. Students assigned via ClassStudent explicit roster
		if (classes != null && !classes.isEmpty()) {
			List<Long> classIds = classes.stream().map(ClassRoom::getId).collect(Collectors.toList());
			List<ClassStudent> classStudents = classStudentRepository.findByClassIdIn(classIds);
			List<Long> studentIds = classStudents.stream().map(ClassStudent::getStudentId).distinct()
					.collect(Collectors.toList());
			if (!studentIds.isEmpty()) {
				List<User> rosterStudents = userRepository.findAllById(studentIds);
				for (User s : rosterStudents) {
					if (s != null && s.getId() != null && s.getRole() == Role.STUDENT) {
						studentMap.putIfAbsent(s.getId(), s);
					}
				}
			}
		}

		// 3. Students assigned via ClassRoom standard/division (school-scoped)
		if (classes != null && !classes.isEmpty()) {
			for (ClassRoom cr : classes) {
				if (cr.getSchoolId() != null) {
					List<Student> schoolStudents = studentRepository.findBySchoolId(cr.getSchoolId());
					String classNormStd = normalizeStandard(cr.getGrade());
					String classDiv = cr.getDivision() != null ? cr.getDivision().trim().toUpperCase() : "";

					for (Student s : schoolStudents) {
						if (s == null || s.getId() == null || s.getRole() != Role.STUDENT) {
							continue;
						}
						String studentNormStd = normalizeStandard(s.getStandard());
						if (!classNormStd.isEmpty() && classNormStd.equals(studentNormStd)) {
							String studentDiv = s.getDivision() != null ? s.getDivision().trim().toUpperCase() : "";
							if (classDiv.isEmpty() || classDiv.equals(studentDiv)) {
								studentMap.putIfAbsent(s.getId(), s);
							}
						}
					}
				}
			}
		}

		// 4. Students assigned via teacher_standard_divisions (school-scoped)
		if (teacher != null && teacher.getId() != null) {
			try {
				List<TeacherStandardDivision> teacherStdDivs = teacherStandardDivisionRepository.findByTeacherId(teacher.getId());
				for (TeacherStandardDivision tsd : teacherStdDivs) {
					if (tsd.getStandardDivision() != null && tsd.getStandardDivision().getSchoolStandard() != null) {
						Long schoolId = teacher.getSchoolId();
						if (schoolId == null && tsd.getStandardDivision().getSchoolStandard().getSchool() != null) {
							schoolId = tsd.getStandardDivision().getSchoolStandard().getSchool().getId();
						}
						if (schoolId != null) {
							String assignedStd = tsd.getStandardDivision().getSchoolStandard().getStandard();
							String assignedDiv = tsd.getStandardDivision().getDivision();
							String normAssignedStd = normalizeStandard(assignedStd);
							String normAssignedDiv = assignedDiv != null ? assignedDiv.trim().toUpperCase() : "";

							List<Student> schoolStudents = studentRepository.findBySchoolId(schoolId);
							for (Student s : schoolStudents) {
								if (s == null || s.getId() == null || s.getRole() != Role.STUDENT) {
									continue;
								}
								String sNormStd = normalizeStandard(s.getStandard());
								if (!normAssignedStd.isEmpty() && normAssignedStd.equals(sNormStd)) {
									String sDiv = s.getDivision() != null ? s.getDivision().trim().toUpperCase() : "";
									if (normAssignedDiv.isEmpty() || normAssignedDiv.equals(sDiv)) {
										studentMap.putIfAbsent(s.getId(), s);
									}
								}
							}
						}
					}
				}
			} catch (Exception e) {
				// Defensive fallback
			}
		}

		// 5. Students assigned via teacher's direct schoolId, standard, and division (if set)
		if (teacher != null && teacher.getSchoolId() != null && teacher.getStandard() != null && !teacher.getStandard().trim().isEmpty()) {
			Long schoolId = teacher.getSchoolId();
			String normTeacherStd = normalizeStandard(teacher.getStandard());
			String normTeacherDiv = teacher.getDivision() != null ? teacher.getDivision().trim().toUpperCase() : "";
			List<Student> schoolStudents = studentRepository.findBySchoolId(schoolId);
			for (Student s : schoolStudents) {
				if (s == null || s.getId() == null || s.getRole() != Role.STUDENT) {
					continue;
				}
				String sNormStd = normalizeStandard(s.getStandard());
				if (!normTeacherStd.isEmpty() && normTeacherStd.equals(sNormStd)) {
					String sDiv = s.getDivision() != null ? s.getDivision().trim().toUpperCase() : "";
					if (normTeacherDiv.isEmpty() || normTeacherDiv.equals(sDiv)) {
						studentMap.putIfAbsent(s.getId(), s);
					}
				}
			}
		}

		return new ArrayList<>(studentMap.values());
	}

	private List<User> getStudentsInClasses(List<ClassRoom> classes) {
		User teacher = getCurrentTeacher();
		return getTeacherStudents(teacher, classes);
	}

	private List<User> getStudentsInClassesFiltered(List<ClassRoom> classes, String search, Status status, String standard, String division) {
		List<User> students = getStudentsInClasses(classes);

		if (standard != null && !standard.trim().isEmpty() && !standard.equalsIgnoreCase("All Standards") && !standard.equalsIgnoreCase("All")) {
			String normStd = normalizeStandard(standard);
			students = students.stream().filter(s -> {
				String sNorm = normalizeStandard(s.getStandard());
				return normStd.equals(sNorm);
			}).collect(Collectors.toList());
		}

		if (division != null && !division.trim().isEmpty() && !division.equalsIgnoreCase("All Divisions") && !division.equalsIgnoreCase("All")) {
			String normDiv = division.trim().toUpperCase();
			students = students.stream().filter(s -> {
				String sDiv = s.getDivision() != null ? s.getDivision().trim().toUpperCase() : "";
				return normDiv.equals(sDiv);
			}).collect(Collectors.toList());
		}

		if (status != null) {
			students = students.stream().filter(s -> s.getStatus() == status).collect(Collectors.toList());
		}

		if (search != null && !search.trim().isEmpty()) {
			String lowerSearch = search.toLowerCase().trim();
			students = students.stream()
					.filter(s -> (s.getFirstName() != null && s.getFirstName().toLowerCase().contains(lowerSearch))
							|| (s.getLastName() != null && s.getLastName().toLowerCase().contains(lowerSearch))
							|| (s.getEmail() != null && s.getEmail().toLowerCase().contains(lowerSearch))
							|| (s.getRollNumber() != null && s.getRollNumber().toLowerCase().contains(lowerSearch))
							|| (s.getId() != null && String.valueOf(s.getId()).contains(lowerSearch)))
					.collect(Collectors.toList());
		}

		return students;
	}

	private List<User> getStudentsInClassesFiltered(List<ClassRoom> classes, String search, Status status, String standard) {
		return getStudentsInClassesFiltered(classes, search, status, standard, null);
	}

	private List<User> getStudentsInClassesFiltered(List<ClassRoom> classes, String search, Status status) {
		return getStudentsInClassesFiltered(classes, search, status, null, null);
	}

	private ProfileResponse buildProfileResponse(User user, Progress progress) {
		int xp = (progress != null && progress.getXp() != null) ? progress.getXp() : 0;
		int liveSpeaking = (int) speakingSessionRepository.countByUserAndCompletedTrue(user);
		int liveGrammar = (int) grammarHistoryRepository.countByUserId(user.getId());
		int liveVocab = (int) vocabularyRepository.countByUser(user);

		return ProfileResponse.builder().id(user.getId()).firstName(user.getFirstName()).lastName(user.getLastName())
				.email(user.getEmail()).role(user.getRole().name()).avatar(user.getAvatar())
				.englishLevel(user.getEnglishLevel()).learningGoal(user.getLearningGoal()).xp(xp)
				.level((xp / 500) + 1)
				.currentStreak(progress != null ? progress.getCurrentStreak() : 0)
				.longestStreak(progress != null ? progress.getLongestStreak() : 0)
				.totalPracticeMinutes(progress != null ? progress.getTotalPracticeMinutes() : 0)
				.totalSpeakingSessions(liveSpeaking)
				.totalGrammarChecks(liveGrammar)
				.totalVocabularyWords(liveVocab)
				.status(user.getStatus())
				.active(user.isActive())
				.build();
	}

	private Double getAverageGrammarScore(User user) {
		return grammarHistoryRepository.findAverageGrammarScoreByUserId(user.getId());
	}

	private Double getAverageSpeakingScore(User user) {
		return speakingSessionRepository.findAverageOverallScoreByUserId(user.getId());
	}

	private Double getAverageListeningScore(User user) {
		Double pronunciation = speakingSessionRepository.findAveragePronunciationScoreByUserId(user.getId());
		Double fluency = speakingSessionRepository.findAverageFluencyScoreByUserId(user.getId());
		Double grammar = speakingSessionRepository.findAverageGrammarScoreByUserId(user.getId());
		Double vocabulary = speakingSessionRepository.findAverageVocabularyScoreByUserId(user.getId());
		double sum = 0;
		int count = 0;
		if (pronunciation != null) {
			sum += pronunciation;
			count++;
		}
		if (fluency != null) {
			sum += fluency;
			count++;
		}
		if (grammar != null) {
			sum += grammar;
			count++;
		}
		if (vocabulary != null) {
			sum += vocabulary;
			count++;
		}
		return count > 0 ? sum / count : null;
	}

	private List<WeeklyProgressResponse> getWeeklyProgressForUser(User user) {
		String[] dayNames = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
		List<WeeklyProgressResponse> weeklyProgress = new ArrayList<>();
		for (String dayName : dayNames) {
			weeklyProgress.add(WeeklyProgressResponse.builder().day(dayName).studyMinutes(0).lessonsCompleted(0)
					.speakingSessions(0).build());
		}

		LocalDate today = LocalDate.now();
		LocalDateTime weekStart = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
				.atStartOfDay();
		LocalDateTime weekEnd = weekStart.plusDays(7);

		List<SpeakingSession> sessions = speakingSessionRepository.findByUserIdAndCreatedAtBetween(user.getId(), weekStart,
				weekEnd);
		int[] studySeconds = new int[7];
		int[] speakingSessions = new int[7];
		int[] lessonsCompleted = new int[7];

		for (SpeakingSession s : sessions) {
			if (s.getCreatedAt() != null && Boolean.TRUE.equals(s.getCompleted())) {
				LocalDate date = s.getCreatedAt().toLocalDate();
				if (!date.isBefore(weekStart.toLocalDate()) && !date.isAfter(weekStart.toLocalDate().plusDays(6))) {
					int dayOfWeekIndex = date.getDayOfWeek().getValue() - 1;
					studySeconds[dayOfWeekIndex] += s.getDuration() != null ? s.getDuration() : 0;
					speakingSessions[dayOfWeekIndex]++;
					lessonsCompleted[dayOfWeekIndex] = 1;
				}
			}
		}

		List<LessonProgress> completedLessons = lessonProgressRepository.findByUserIdAndCompletedAtBetween(user.getId(),
				weekStart, weekEnd);
		for (LessonProgress lp : completedLessons) {
			if (lp.getCompletedAt() != null) {
				LocalDate date = lp.getCompletedAt().toLocalDate();
				if (!date.isBefore(weekStart.toLocalDate()) && !date.isAfter(weekStart.toLocalDate().plusDays(6))) {
					int dayOfWeekIndex = date.getDayOfWeek().getValue() - 1;
					lessonsCompleted[dayOfWeekIndex]++;
				}
			}
		}

		for (int i = 0; i < 7; i++) {
			WeeklyProgressResponse dayRes = weeklyProgress.get(i);
			dayRes.setStudyMinutes((int) Math.ceil(studySeconds[i] / 60.0));
			dayRes.setSpeakingSessions(speakingSessions[i]);
			dayRes.setLessonsCompleted(lessonsCompleted[i]);
		}

		return weeklyProgress;
	}

	private List<WeeklyProgressResponse> getEmptyWeeklyProgress() {
		String[] dayNames = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
		List<WeeklyProgressResponse> weeklyProgress = new ArrayList<>();
		for (String dayName : dayNames) {
			weeklyProgress.add(WeeklyProgressResponse.builder().day(dayName).studyMinutes(0).lessonsCompleted(0)
					.speakingSessions(0).build());
		}
		return weeklyProgress;
	}

	private List<WeeklyProgressResponse> buildAggregatedWeeklyProgressFromLists(
			List<SpeakingSession> sessions, List<LessonProgress> completedLessons,
			LocalDateTime weekStart, LocalDate today) {
		List<WeeklyProgressResponse> weeklyProgress = getEmptyWeeklyProgress();

		int[] studySeconds = new int[7];
		int[] speakingSessions = new int[7];
		int[] lessonsCompleted = new int[7];

		for (SpeakingSession s : sessions) {
			if (s.getCreatedAt() != null && Boolean.TRUE.equals(s.getCompleted())) {
				LocalDate date = s.getCreatedAt().toLocalDate();
				if (!date.isBefore(weekStart.toLocalDate()) && !date.isAfter(weekStart.toLocalDate().plusDays(6))) {
					int dayOfWeekIndex = date.getDayOfWeek().getValue() - 1;
					studySeconds[dayOfWeekIndex] += s.getDuration() != null ? s.getDuration() : 0;
					speakingSessions[dayOfWeekIndex]++;
					lessonsCompleted[dayOfWeekIndex] = 1;
				}
			}
		}

		for (LessonProgress lp : completedLessons) {
			LocalDateTime dt = lp.getCompletedAt() != null ? lp.getCompletedAt() : lp.getUpdatedAt();
			if (dt != null) {
				LocalDate date = dt.toLocalDate();
				if (!date.isBefore(weekStart.toLocalDate()) && !date.isAfter(weekStart.toLocalDate().plusDays(6))) {
					int dayOfWeekIndex = date.getDayOfWeek().getValue() - 1;
					lessonsCompleted[dayOfWeekIndex]++;
				}
			}
		}

		for (int i = 0; i < 7; i++) {
			WeeklyProgressResponse dayRes = weeklyProgress.get(i);
			dayRes.setStudyMinutes((int) Math.ceil(studySeconds[i] / 60.0));
			dayRes.setSpeakingSessions(speakingSessions[i]);
			dayRes.setLessonsCompleted(lessonsCompleted[i]);
		}

		return weeklyProgress;
	}

	private List<WeeklyProgressResponse> getAggregatedWeeklyProgress(List<User> students) {
		if (students == null || students.isEmpty()) {
			return getEmptyWeeklyProgress();
		}
		List<Long> studentIds = students.stream().map(User::getId).collect(Collectors.toList());
		LocalDate today = LocalDate.now();
		LocalDateTime weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay();
		LocalDateTime weekEnd = weekStart.plusDays(7);

		List<SpeakingSession> sessions = speakingSessionRepository.findByUserIdsAndCreatedAtBetween(studentIds, weekStart, weekEnd);
		List<LessonProgress> completedLessons = lessonProgressRepository.findByUserIdsAndCompletedAtBetween(studentIds, weekStart, weekEnd);

		return buildAggregatedWeeklyProgressFromLists(sessions, completedLessons, weekStart, today);
	}

	private List<RecentActivityResponse> buildRecentActivityFromLists(
			List<SpeakingSession> sessions, List<Vocabulary> vocabs, List<GrammarHistory> grammars) {
		List<RecentActivityResponse> activities = new ArrayList<>();

		for (SpeakingSession s : sessions) {
			if (Boolean.TRUE.equals(s.getCompleted())) {
				activities.add(RecentActivityResponse.builder().id("speaking-" + s.getId()).type("speaking").icon("mic")
						.title(s.getTopic() != null ? "Speaking Session: " + s.getTopic() : "Speaking Session")
						.time(s.getCreatedAt()).xp(15).build());
			}
		}

		for (Vocabulary v : vocabs) {
			activities.add(RecentActivityResponse.builder().id("vocabulary-" + v.getId()).type("vocabulary")
					.icon("library")
					.title(v.getWord() != null ? "Vocabulary Practice: " + v.getWord() : "Vocabulary Practice")
					.time(v.getCreatedAt()).xp(8).build());
		}

		for (GrammarHistory g : grammars) {
			activities.add(RecentActivityResponse.builder().id("grammar-" + g.getId()).type("grammar").icon("text")
					.title("Grammar Practice").time(g.getCreatedAt()).xp(10).build());
		}

		activities.sort((a, b) -> {
			if (a.getTime() == null && b.getTime() == null) return 0;
			if (a.getTime() == null) return 1;
			if (b.getTime() == null) return -1;
			return b.getTime().compareTo(a.getTime());
		});
		if (activities.size() > 10) {
			return activities.subList(0, 10);
		}
		return activities;
	}

	private List<RecentActivityResponse> getRecentActivityForStudents(List<User> students) {
		if (students == null || students.isEmpty()) {
			return new ArrayList<>();
		}
		List<Long> studentIds = students.stream().map(User::getId).collect(Collectors.toList());
		LocalDateTime now = LocalDateTime.now();
		LocalDateTime oneWeekAgo = now.minusDays(7);

		List<SpeakingSession> sessions = speakingSessionRepository.findByUserIdsAndCreatedAtBetween(studentIds, oneWeekAgo, now);
		List<Vocabulary> vocabs = vocabularyRepository.findByUserIdsAndCreatedAtAfter(studentIds, oneWeekAgo);
		List<GrammarHistory> grammars = grammarHistoryRepository.findByUserIdsAndCreatedAtBetween(studentIds, oneWeekAgo, now);

		return buildRecentActivityFromLists(sessions, vocabs, grammars);
	}

	private static class ResolvedTeacherSchool {
		final Long id;
		final String name;

		ResolvedTeacherSchool(Long id, String name) {
			this.id = id;
			this.name = name;
		}
	}

	private ResolvedTeacherSchool resolveTeacherSchool(User teacher, List<ClassRoom> classes) {
		String resolvedSchoolName = teacher.getSchoolName();
		Long resolvedSchoolId = teacher.getSchoolId();

		if ((resolvedSchoolName == null || resolvedSchoolName.trim().isEmpty()) && resolvedSchoolId != null && schoolRepository != null) {
			resolvedSchoolName = schoolRepository.findById(resolvedSchoolId)
					.map(s -> s.getName() != null && !s.getName().trim().isEmpty() ? s.getName() : s.getSchoolName())
					.orElse(null);
		}

		if ((resolvedSchoolName == null || resolvedSchoolName.trim().isEmpty()) && teacherStandardDivisionRepository != null && teacher.getId() != null) {
			List<TeacherStandardDivision> teacherStdDivs = teacherStandardDivisionRepository.findByTeacherId(teacher.getId());
			if (teacherStdDivs != null) {
				for (TeacherStandardDivision tsd : teacherStdDivs) {
					if (tsd.getStandardDivision() != null && tsd.getStandardDivision().getSchoolStandard() != null
							&& tsd.getStandardDivision().getSchoolStandard().getSchool() != null) {
						School sch = tsd.getStandardDivision().getSchoolStandard().getSchool();
						if (resolvedSchoolName == null || resolvedSchoolName.trim().isEmpty()) {
							resolvedSchoolName = sch.getName() != null && !sch.getName().trim().isEmpty() ? sch.getName() : sch.getSchoolName();
						}
						if (resolvedSchoolId == null) {
							resolvedSchoolId = sch.getId();
						}
						if (resolvedSchoolName != null && !resolvedSchoolName.trim().isEmpty()) {
							break;
						}
					}
				}
			}
		}

		if ((resolvedSchoolName == null || resolvedSchoolName.trim().isEmpty()) && classes != null && schoolRepository != null) {
			for (ClassRoom cr : classes) {
				if (cr.getSchoolId() != null) {
					resolvedSchoolName = schoolRepository.findById(cr.getSchoolId())
							.map(s -> s.getName() != null && !s.getName().trim().isEmpty() ? s.getName() : s.getSchoolName())
							.orElse(null);
					if (resolvedSchoolId == null) {
						resolvedSchoolId = cr.getSchoolId();
					}
					if (resolvedSchoolName != null && !resolvedSchoolName.trim().isEmpty()) {
						break;
					}
				}
			}
		}

		// Backfill teacher school details if missing
		if (resolvedSchoolName != null && (teacher.getSchoolName() == null || teacher.getSchoolName().trim().isEmpty())) {
			teacher.setSchoolName(resolvedSchoolName);
			if (resolvedSchoolId != null && teacher.getSchoolId() == null) {
				teacher.setSchoolId(resolvedSchoolId);
			}
			try {
				if (teacher instanceof Teacher && teacherRepository != null) {
					teacherRepository.save((Teacher) teacher);
				} else if (userRepository != null) {
					userRepository.save(teacher);
				}
			} catch (Exception ignored) {
			}
		}

		return new ResolvedTeacherSchool(resolvedSchoolId, resolvedSchoolName);
	}

	@Override
	public TeacherDashboardResponse getTeacherDashboard() {
		User teacher = getCurrentTeacher();
		CachedDashboard cached = teacherDashboardCache.get(teacher.getId());
		if (cached != null && (System.currentTimeMillis() - cached.timestamp < 60_000)) {
			return cached.data;
		}

		List<ClassRoom> classes = getTeacherClasses(teacher.getId());
		List<User> students = getStudentsInClasses(classes);
		ResolvedTeacherSchool resolvedSchool = resolveTeacherSchool(teacher, classes);

		ProfileResponse profile = ProfileResponse.builder().id(teacher.getId()).firstName(teacher.getFirstName())
				.lastName(teacher.getLastName()).email(teacher.getEmail()).role(teacher.getRole().name())
				.avatar(teacher.getAvatar()).englishLevel(teacher.getEnglishLevel()).learningGoal(teacher.getLearningGoal())
				.schoolId(resolvedSchool.id).schoolName(resolvedSchool.name)
				.build();

		Map<String, AssignedClassResponse> assignedClassMap = buildTeacherAssignedClassMap(teacher, classes, students);
		List<String> assignedStandards = new ArrayList<>();
		List<String> assignedDivisions = new ArrayList<>();
		List<String> formattedStandards = new ArrayList<>();

		for (AssignedClassResponse ac : assignedClassMap.values()) {
			if (ac.getStandard() != null && !ac.getStandard().trim().isEmpty() && !assignedStandards.contains(ac.getStandard().trim())) {
				assignedStandards.add(ac.getStandard().trim());
			}
			if (ac.getDivision() != null && !ac.getDivision().trim().isEmpty() && !assignedDivisions.contains(ac.getDivision().trim().toUpperCase())) {
				assignedDivisions.add(ac.getDivision().trim().toUpperCase());
			}
			if (ac.getName() != null && !ac.getName().trim().isEmpty() && !formattedStandards.contains(ac.getName().trim())) {
				formattedStandards.add(ac.getName().trim());
			}
		}

		Collections.sort(assignedStandards);
		Collections.sort(assignedDivisions);
		formattedStandards.sort(Comparator.naturalOrder());
		String assignedStandardString = formattedStandards.isEmpty() ? null : String.join(", ", formattedStandards);
		List<AssignedClassResponse> assignedClasses = new ArrayList<>(assignedClassMap.values());
		assignedClasses.sort((c1, c2) -> {
			int g1 = extractGradeNumber(c1.getName() != null ? c1.getName() : c1.getStandard());
			int g2 = extractGradeNumber(c2.getName() != null ? c2.getName() : c2.getStandard());
			if (g1 != g2) return Integer.compare(g1, g2);
			String d1 = c1.getDivision() != null ? c1.getDivision() : "";
			String d2 = c2.getDivision() != null ? c2.getDivision() : "";
			return d1.compareToIgnoreCase(d2);
		});

		int totalStudents = students.size();
		if (students.isEmpty()) {
			SkillPerformanceSummaryResponse skillPerformance = SkillPerformanceSummaryResponse.builder()
					.grammar(0.0).vocabulary(0.0).speaking(0.0).listening(0.0).build();
			TeacherDashboardResponse response = TeacherDashboardResponse.builder().teacherInfo(profile).assignedClasses(assignedClasses)
					.assignedStandards(assignedStandards).assignedDivisions(assignedDivisions)
					.assignedStandardString(assignedStandardString)
					.schoolId(resolvedSchool.id).schoolName(resolvedSchool.name)
					.totalStudents(0).averageProgress(0.0).weeklyCompletion(getEmptyWeeklyProgress())
					.completedStudents(0).skillPerformance(skillPerformance)
					.studentsRequiringAttention(new ArrayList<>()).recentActivity(new ArrayList<>()).build();
			teacherDashboardCache.put(teacher.getId(), new CachedDashboard(System.currentTimeMillis(), response));
			return response;
		}

		List<Long> studentIds = students.stream().map(User::getId).collect(Collectors.toList());

		// 1. Bulk fetch progress
		List<Progress> progressList = progressRepository.findByUserIn(students);
		Map<Long, Progress> progressMap = progressList.stream()
				.filter(p -> p.getUser() != null)
				.collect(Collectors.toMap(p -> p.getUser().getId(), p -> p, (p1, p2) -> p1));

		// 2. Bulk fetch speaking scores (overall, pronunciation, fluency, grammar, vocabulary)
		List<Object[]> speakingAggregates = speakingSessionRepository.findAverageScoresByUserIds(studentIds);
		Map<Long, Double> speakingScoreMap = new HashMap<>();
		Map<Long, Double> listeningScoreMap = new HashMap<>();
		for (Object[] row : speakingAggregates) {
			if (row[0] != null) {
				Long uid = (Long) row[0];
				Double overall = (Double) row[1];
				Double pronunciation = (Double) row[2];
				Double fluency = (Double) row[3];
				Double spGrammar = (Double) row[4];
				Double spVocabulary = (Double) row[5];

				if (overall != null) {
					speakingScoreMap.put(uid, overall);
				}

				double sum = 0;
				int count = 0;
				if (pronunciation != null) { sum += pronunciation; count++; }
				if (fluency != null) { sum += fluency; count++; }
				if (spGrammar != null) { sum += spGrammar; count++; }
				if (spVocabulary != null) { sum += spVocabulary; count++; }
				if (count > 0) {
					listeningScoreMap.put(uid, sum / count);
				}
			}
		}

		// 3. Bulk fetch grammar scores
		List<Object[]> grammarAggregates = grammarHistoryRepository.findAverageGrammarScoreByUserIds(studentIds);
		Map<Long, Double> grammarScoreMap = new HashMap<>();
		for (Object[] row : grammarAggregates) {
			if (row[0] != null && row[1] != null) {
				grammarScoreMap.put((Long) row[0], (Double) row[1]);
			}
		}

		// 4. Calculate overall average progress
		double totalStudentPercentages = 0;
		for (User s : students) {
			double sGrammar = grammarScoreMap.getOrDefault(s.getId(), 0.0);
			double sSpeaking = speakingScoreMap.getOrDefault(s.getId(), 0.0);
			double sListening = listeningScoreMap.getOrDefault(s.getId(), 0.0);
			Progress p = progressMap.get(s.getId());
			double sVocabXp = (p != null && p.getXp() != null) ? Math.min(100.0, (p.getXp() / 500.0) * 100.0) : 0;

			double sAvg = (sGrammar + sSpeaking + sListening + sVocabXp) / 4.0;
			totalStudentPercentages += sAvg;
		}
		double avgProgress = totalStudentPercentages / students.size();

		// 5. Bulk fetch completed students count
		long completedStudentsCount = lessonProgressRepository.countDistinctCompletedUsersIn(studentIds);

		// 6. Calculate skill performance averages
		List<Double> grammarScores = new ArrayList<>();
		List<Double> vocabularyScores = new ArrayList<>();
		List<Double> speakingScores = new ArrayList<>();
		List<Double> listeningScores = new ArrayList<>();

		for (User student : students) {
			Double g = grammarScoreMap.get(student.getId());
			if (g != null) grammarScores.add(g);

			Progress p = progressMap.get(student.getId());
			double v = (p != null && p.getTotalVocabularyWords() != null) ? (double) p.getTotalVocabularyWords() : 0.0;
			if (v > 0) vocabularyScores.add(v);

			Double sp = speakingScoreMap.get(student.getId());
			if (sp != null) speakingScores.add(sp);

			Double l = listeningScoreMap.get(student.getId());
			if (l != null) listeningScores.add(l);
		}

		double avgGrammar = grammarScores.isEmpty() ? 0 : grammarScores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
		double avgVocabulary = vocabularyScores.isEmpty() ? 0 : vocabularyScores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
		double avgSpeaking = speakingScores.isEmpty() ? 0 : speakingScores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
		double avgListening = listeningScores.isEmpty() ? 0 : listeningScores.stream().mapToDouble(Double::doubleValue).average().orElse(0);

		SkillPerformanceSummaryResponse skillPerformance = SkillPerformanceSummaryResponse.builder()
				.grammar(avgGrammar).vocabulary(avgVocabulary).speaking(avgSpeaking).listening(avgListening).build();

		// 7. Recent sessions in the last 7 days for students requiring attention
		LocalDateTime now = LocalDateTime.now();
		LocalDateTime sevenDaysAgo = now.minusDays(7);
		List<SpeakingSession> recentSevenDaySessions = speakingSessionRepository.findByUserIdsAndCreatedAtBetween(studentIds, sevenDaysAgo, now);
		Set<Long> studentsWithRecentPractice = recentSevenDaySessions.stream()
				.filter(s -> Boolean.TRUE.equals(s.getCompleted()))
				.map(s -> s.getUser().getId())
				.collect(Collectors.toSet());

		List<StudentAttentionItemResponse> attentionStudents = new ArrayList<>();
		for (User student : students) {
			List<String> reasons = new ArrayList<>();
			String severity = "low";

			Progress p = progressMap.get(student.getId());
			int xp = p != null && p.getXp() != null ? p.getXp() : 0;

			if (xp < 50) {
				reasons.add("Very low progress");
				severity = "high";
			}

			Double speakingScore = speakingScoreMap.get(student.getId());
			if (speakingScore != null && speakingScore < 30) {
				reasons.add("Low speaking performance");
				if ("high".equals(severity))
					severity = "high";
				else
					severity = "medium";
			}

			if (!studentsWithRecentPractice.contains(student.getId()) && student.getStatus() == Status.ACTIVE) {
				reasons.add("No practice this week");
				if ("low".equals(severity))
					severity = "medium";
			}

			if (student.getStatus() == Status.INACTIVE) {
				reasons.add("Account inactive");
				severity = "high";
			}

			Double grScore = grammarScoreMap.get(student.getId());
			Double lsScore = listeningScoreMap.get(student.getId());
			List<Double> validScores = new ArrayList<>();
			if (speakingScore != null) validScores.add(speakingScore);
			if (grScore != null) validScores.add(grScore);
			if (lsScore != null) validScores.add(lsScore);

			double realScore = validScores.isEmpty()
					? (xp > 0 ? Math.min(100.0, xp) : 0.0)
					: validScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
			int studentProg = (int) Math.round(realScore);

			if (!reasons.isEmpty()) {
				attentionStudents.add(StudentAttentionItemResponse.builder()
						.studentId(student.getId())
						.studentName((student.getFirstName() + " " + (student.getLastName() != null ? student.getLastName() : "")).trim())
						.reason(String.join(", ", reasons))
						.severity(severity)
						.progress(studentProg)
						.score(realScore)
						.build());
			}
		}
		attentionStudents.sort((a, b) -> {
			int order = getSeverityOrder(b.getSeverity()) - getSeverityOrder(a.getSeverity());
			return Integer.compare(order, 0);
		});

		// 8. Weekly progress calculation in bulk
		LocalDate today = LocalDate.now();
		LocalDateTime weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay();
		LocalDateTime weekEnd = weekStart.plusDays(7);
		List<SpeakingSession> weeklySessions = speakingSessionRepository.findByUserIdsAndCreatedAtBetween(studentIds, weekStart, weekEnd);
		List<LessonProgress> weeklyLessons = lessonProgressRepository.findByUserIdsAndCompletedAtBetween(studentIds, weekStart, weekEnd);
		List<WeeklyProgressResponse> weeklyCompletion = buildAggregatedWeeklyProgressFromLists(weeklySessions, weeklyLessons, weekStart, today);

		// 9. Recent activity in bulk
		List<Vocabulary> recentVocab = vocabularyRepository.findByUserIdsAndCreatedAtAfter(studentIds, sevenDaysAgo);
		List<GrammarHistory> recentGrammar = grammarHistoryRepository.findByUserIdsAndCreatedAtBetween(studentIds, sevenDaysAgo, now);
		List<RecentActivityResponse> recentActivity = buildRecentActivityFromLists(recentSevenDaySessions, recentVocab, recentGrammar);

		TeacherDashboardResponse response = TeacherDashboardResponse.builder().teacherInfo(profile).assignedClasses(assignedClasses)
				.assignedStandards(assignedStandards).assignedDivisions(assignedDivisions)
				.assignedStandardString(assignedStandardString)
				.schoolId(resolvedSchool.id).schoolName(resolvedSchool.name)
				.totalStudents(totalStudents).averageProgress(avgProgress).weeklyCompletion(weeklyCompletion)
				.completedStudents((int) completedStudentsCount).skillPerformance(skillPerformance)
				.studentsRequiringAttention(attentionStudents).recentActivity(recentActivity).build();

		teacherDashboardCache.put(teacher.getId(), new CachedDashboard(System.currentTimeMillis(), response));
		return response;
	}


	private int getSeverityOrder(String severity) {
		if ("high".equals(severity))
			return 3;
		if ("medium".equals(severity))
			return 2;
		return 1;
	}

	@Override
	public TeacherStudentsListResponse getStudents(String search, Status status) {
		return getStudents(search, status, null, null);
	}

	@Override
	public TeacherStudentsListResponse getStudents(String search, Status status, String standard) {
		return getStudents(search, status, standard, null);
	}

	@Override
	public TeacherStudentsListResponse getStudents(String search, Status status, String standard, String division) {
		User teacher = getCurrentTeacher();
		List<ClassRoom> classes = getTeacherClasses(teacher.getId());
		List<User> students = getStudentsInClassesFiltered(classes, search, status, standard, division);

		Map<String, AssignedClassResponse> assignedClassMap = buildTeacherAssignedClassMap(teacher, classes, students);
		List<AssignedClassResponse> assignedClasses = new ArrayList<>(assignedClassMap.values());
		List<String> assignedStandards = new ArrayList<>();
		List<String> assignedDivisions = new ArrayList<>();

		for (AssignedClassResponse ac : assignedClassMap.values()) {
			if (ac.getStandard() != null && !ac.getStandard().trim().isEmpty() && !assignedStandards.contains(ac.getStandard().trim())) {
				assignedStandards.add(ac.getStandard().trim());
			}
			if (ac.getDivision() != null && !ac.getDivision().trim().isEmpty() && !assignedDivisions.contains(ac.getDivision().trim().toUpperCase())) {
				assignedDivisions.add(ac.getDivision().trim().toUpperCase());
			}
		}

		Collections.sort(assignedStandards);
		Collections.sort(assignedDivisions);

		List<TeacherStudentSummaryResponse> studentSummaries = students.stream()
				.map(s -> mapToStudentSummary(s, classes))
				.collect(Collectors.toList());

		return TeacherStudentsListResponse.builder()
				.assignedClasses(assignedClasses)
				.assignedStandards(assignedStandards)
				.assignedDivisions(assignedDivisions)
				.totalStudents(studentSummaries.size())
				.students(studentSummaries)
				.build();
	}

	private TeacherStudentSummaryResponse mapToStudentSummary(User student, List<ClassRoom> teacherClasses) {
		Progress progress = progressRepository.findByUser(student).orElse(null);
		double overallProgress = progress != null && progress.getXp() != null ? progress.getXp() : 0;

		Double grammarScore = getAverageGrammarScore(student);
		Double vocabularyScore = progress != null && progress.getTotalVocabularyWords() != null
				? progress.getTotalVocabularyWords().doubleValue()
				: 0.0;
		Double speakingScore = getAverageSpeakingScore(student);
		Double listeningScore = getAverageListeningScore(student);

		String std = student.getStandard();
		String div = student.getDivision();

		if ((std == null || std.trim().isEmpty() || div == null || div.trim().isEmpty()) && teacherClasses != null) {
			for (ClassRoom cr : teacherClasses) {
				if ((std == null || std.trim().isEmpty()) && cr.getGrade() != null) {
					std = cr.getGrade();
				}
				if ((div == null || div.trim().isEmpty()) && cr.getDivision() != null) {
					div = cr.getDivision();
				}
			}
		}

		return TeacherStudentSummaryResponse.builder().id(student.getId()).firstName(student.getFirstName())
				.lastName(student.getLastName()).email(student.getEmail()).rollNumber(student.getRollNumber())
				.overallProgress(overallProgress).grammarScore(grammarScore).vocabularyScore(vocabularyScore)
				.speakingScore(speakingScore).listeningScore(listeningScore).lastActive(student.getUpdatedAt())
				.status(student.getStatus()).standard(std != null ? std : "").division(div != null ? div : "")
				.build();
	}

	private TeacherStudentSummaryResponse mapToStudentSummary(User student) {
		return mapToStudentSummary(student, null);
	}

	@Override
	public TeacherStudentDetailResponse getStudentDetail(Long studentId) {
		User teacher = getCurrentTeacher();
		List<ClassRoom> classes = getTeacherClasses(teacher.getId());
		List<User> students = getTeacherStudents(teacher, classes);
		boolean belongsToTeacher = students.stream().anyMatch(s -> s.getId().equals(studentId));
		if (!belongsToTeacher) {
			throw new AccessDeniedException("Access denied: Student is not assigned to your classes");
		}

		User student = userRepository.findById(studentId).orElseThrow(() -> new ResourceNotFoundException("Student not found"));
		if (student.getRole() != Role.STUDENT) {
			throw new RuntimeException("User is not a student");
		}

		Progress progress = progressRepository.findByUser(student).orElse(null);
		ProfileResponse profile = buildProfileResponse(student, progress);

		List<SpeakingSession> allStudentSessions = speakingSessionRepository.findByUser(student);
		int completedSpeakingSessions = (int) allStudentSessions.stream()
				.filter(s -> Boolean.TRUE.equals(s.getCompleted()))
				.count();
		int totalSpeakingSessions = completedSpeakingSessions;
		int totalVocabularyWords = (int) vocabularyRepository.countByUser(student);
		int totalGrammarChecks = (int) grammarHistoryRepository.countByUserId(student.getId());

		Double grammarScore = getAverageGrammarScore(student);
		Double speakingScore = getAverageSpeakingScore(student);
		Double listeningScore = getAverageListeningScore(student);
		Double vocabularyScore = speakingSessionRepository.findAverageVocabularyScoreByUserId(student.getId());
		if (vocabularyScore == null || vocabularyScore == 0.0) {
			vocabularyScore = totalVocabularyWords > 0 ? Math.min(95.0, 60.0 + totalVocabularyWords * 2.0) : 0.0;
		}

		int lessonsCompleted = (int) lessonProgressRepository.countByUserIdAndCompletedTrue(student.getId());

		List<Double> validScores = new ArrayList<>();
		if (speakingScore != null && speakingScore > 0) validScores.add(speakingScore);
		if (grammarScore != null && grammarScore > 0) validScores.add(grammarScore);
		if (listeningScore != null && listeningScore > 0) validScores.add(listeningScore);
		if (vocabularyScore != null && vocabularyScore > 0) validScores.add(vocabularyScore);

		Double overallScore = validScores.isEmpty()
				? (speakingScore != null ? speakingScore : 0.0)
				: Math.round(validScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0) * 10.0) / 10.0;

		PerformanceSummaryResponse performance = PerformanceSummaryResponse.builder().overallScore(overallScore)
				.grammarScore(grammarScore).vocabularyScore(vocabularyScore).speakingScore(speakingScore)
				.listeningScore(listeningScore).lessonsCompleted(lessonsCompleted)
				.totalSpeakingSessions(totalSpeakingSessions)
				.completedSpeakingSessions(completedSpeakingSessions)
				.totalVocabularyWords(totalVocabularyWords)
				.totalGrammarChecks(totalGrammarChecks)
				.build();

		List<RecentActivityResponse> recentActivity = new ArrayList<>();
		LocalDateTime oneWeekAgo = LocalDateTime.now().minusDays(7);

		List<SpeakingSession> sessions = speakingSessionRepository.findByUserIdAndCreatedAtBetween(student.getId(), oneWeekAgo,
				LocalDateTime.now());
		for (SpeakingSession s : sessions) {
			if (Boolean.TRUE.equals(s.getCompleted())) {
				recentActivity.add(RecentActivityResponse.builder().id("speaking-" + s.getId()).type("speaking").icon("mic")
						.title(s.getTopic() != null ? "Speaking Session: " + s.getTopic() : "Speaking Session")
						.time(s.getCreatedAt()).xp(15).build());
			}
		}

		List<Vocabulary> vocabs = vocabularyRepository.findByUserOrderByCreatedAtDesc(student);
		for (Vocabulary v : vocabs) {
			if (v.getCreatedAt() != null && !v.getCreatedAt().isBefore(oneWeekAgo)) {
				recentActivity.add(RecentActivityResponse.builder().id("vocabulary-" + v.getId()).type("vocabulary")
						.icon("library")
						.title(v.getWord() != null ? "Vocabulary Practice: " + v.getWord() : "Vocabulary Practice")
						.time(v.getCreatedAt()).xp(8).build());
			}
		}

		List<GrammarHistory> grammars = grammarHistoryRepository.findByUserIdAndCreatedAtBetween(student.getId(), oneWeekAgo,
				LocalDateTime.now());
		for (GrammarHistory g : grammars) {
			recentActivity.add(RecentActivityResponse.builder().id("grammar-" + g.getId()).type("grammar").icon("text")
					.title("Grammar Practice").time(g.getCreatedAt()).xp(10).build());
		}

		recentActivity.sort((a, b) -> b.getTime().compareTo(a.getTime()));
		if (recentActivity.size() > 10) {
			recentActivity = recentActivity.subList(0, 10);
		}

		List<StrengthImprovementResponse> strengths = new ArrayList<>();
		List<StrengthImprovementResponse> improvements = new ArrayList<>();

		if (grammarScore != null && grammarScore >= 70) {
			strengths.add(StrengthImprovementResponse.builder().skill("Grammar").score(grammarScore).label("Strong").build());
		} else if (grammarScore != null && grammarScore < 50) {
			improvements.add(StrengthImprovementResponse.builder().skill("Grammar").score(grammarScore).label("Needs Improvement").build());
		}

		if (vocabularyScore >= 70) {
			strengths.add(StrengthImprovementResponse.builder().skill("Vocabulary").score(vocabularyScore).label("Strong").build());
		} else if (vocabularyScore < 50) {
			improvements.add(StrengthImprovementResponse.builder().skill("Vocabulary").score(vocabularyScore).label("Needs Improvement").build());
		}

		if (speakingScore != null && speakingScore >= 70) {
			strengths.add(StrengthImprovementResponse.builder().skill("Speaking").score(speakingScore).label("Strong").build());
		} else if (speakingScore != null && speakingScore < 50) {
			improvements.add(StrengthImprovementResponse.builder().skill("Speaking").score(speakingScore).label("Needs Improvement").build());
		}

		if (listeningScore != null && listeningScore >= 70) {
			strengths.add(StrengthImprovementResponse.builder().skill("Listening").score(listeningScore).label("Strong").build());
		} else if (listeningScore != null && listeningScore < 50) {
			improvements.add(StrengthImprovementResponse.builder().skill("Listening").score(listeningScore).label("Needs Improvement").build());
		}

		List<Achievement> unlockedAchievements = achievementRepository.findByUserIdAndUnlockedTrueOrderByUnlockedAtDesc(student.getId());
		List<AchievementResponse> achievements = unlockedAchievements.stream()
				.map(a -> AchievementResponse.builder().id(a.getId()).title(a.getTitle()).description(a.getDescription())
						.xpReward(a.getXpReward()).tier(a.getTier() != null ? a.getTier() : 1).unlocked(a.getUnlocked())
						.unlockedAt(a.getUnlockedAt()).createdAt(a.getCreatedAt()).build())
				.collect(Collectors.toList());

		int totalPracticeMinutes = progress != null && progress.getTotalPracticeMinutes() != null ? progress.getTotalPracticeMinutes() : 0;
		double averageSessionScore = speakingScore != null ? speakingScore : 0;

		PracticeStatisticsResponse practiceStatistics = PracticeStatisticsResponse.builder()
				.totalSpeakingSessions(totalSpeakingSessions)
				.completedSpeakingSessions(completedSpeakingSessions)
				.totalPracticeMinutes(totalPracticeMinutes)
				.totalGrammarChecks(totalGrammarChecks)
				.totalVocabularyWords(totalVocabularyWords)
				.totalLessonsCompleted(lessonsCompleted)
				.averageSessionScore(averageSessionScore)
				.build();

		List<WeeklyProgressResponse> weeklyCompletion = getWeeklyProgressForUser(student);

		Integer currentStreak = progress != null ? progress.getCurrentStreak() : 0;

		LocalDateTime lastPracticeDate = null;
		SpeakingSessionDetailResponse latestSpeakingDetail = null;
		List<SpeakingSession> completedSessions = speakingSessionRepository.findByUserAndCompletedTrueOrderByCreatedAtDesc(student);
		if (!completedSessions.isEmpty()) {
			SpeakingSession s = completedSessions.get(0);
			lastPracticeDate = s.getCreatedAt();
			ConversationFeedback fb = null;
			if (conversationFeedbackRepository != null) {
				try {
					fb = conversationFeedbackRepository.findBySession(s).orElse(null);
				} catch (Exception ignored) {}
			}
			SpeakingSessionDetailResponse.FeedbackDto fbDto = null;
			if (fb != null) {
				fbDto = SpeakingSessionDetailResponse.FeedbackDto.builder()
						.grammarCorrections(fb.getGrammarCorrections())
						.betterSentences(fb.getBetterSentences())
						.vocabularySuggestions(fb.getVocabularySuggestions())
						.summary(fb.getSummary())
						.build();
			}
			latestSpeakingDetail = SpeakingSessionDetailResponse.builder()
					.id(s.getId())
					.scenario(s.getScenario() != null ? s.getScenario() : s.getTopic())
					.duration(s.getDuration())
					.xpEarned(s.getXpEarned())
					.score(s.getScore())
					.overallScore(s.getOverallScore() != null ? s.getOverallScore() : s.getScore())
					.fluencyScore(s.getFluencyScore())
					.grammarScore(s.getGrammarScore())
					.vocabularyScore(s.getVocabularyScore())
					.pronunciationScore(s.getPronunciationScore())
					.feedback(s.getFeedback())
					.createdAt(s.getCreatedAt())
					.feedbackDetail(fbDto)
					.build();
		} else {
			List<LessonProgress> lessonProgresses = lessonProgressRepository.findByUserOrderByLastOpenedAtDesc(student);
			if (!lessonProgresses.isEmpty() && lessonProgresses.get(0).getLastOpenedAt() != null) {
				lastPracticeDate = lessonProgresses.get(0).getLastOpenedAt();
			}
		}

		String std = student.getStandard();
		String div = student.getDivision();

		if ((std == null || std.trim().isEmpty() || div == null || div.trim().isEmpty()) && classes != null) {
			for (ClassRoom cr : classes) {
				if ((std == null || std.trim().isEmpty()) && cr.getGrade() != null) {
					std = cr.getGrade();
				}
				if ((div == null || div.trim().isEmpty()) && cr.getDivision() != null) {
					div = cr.getDivision();
				}
			}
		}

		String schoolName = student.getSchoolName();
		if ((schoolName == null || schoolName.trim().isEmpty()) && student.getSchoolId() != null) {
			schoolName = schoolRepository.findById(student.getSchoolId()).map(School::getName).orElse("");
		}
		if ((schoolName == null || schoolName.trim().isEmpty()) && teacher.getSchoolId() != null) {
			schoolName = schoolRepository.findById(teacher.getSchoolId()).map(School::getName).orElse("");
		}

		double attendanceRate = 0.0;
		if (weeklyCompletion != null && !weeklyCompletion.isEmpty()) {
			long activeDays = weeklyCompletion.stream().filter(w -> (w.getStudyMinutes() != null && w.getStudyMinutes() > 0)
					|| (w.getSpeakingSessions() != null && w.getSpeakingSessions() > 0)
					|| (w.getLessonsCompleted() != null && w.getLessonsCompleted() > 0)).count();
			if (activeDays > 0) {
				attendanceRate = Math.round((activeDays / 7.0) * 100.0);
			} else if (student.getStatus() == Status.ACTIVE) {
				attendanceRate = totalSpeakingSessions > 0 || lessonsCompleted > 0 ? 85.0 : 75.0;
			}
		} else if (student.getStatus() == Status.ACTIVE) {
			attendanceRate = 80.0;
		}

		return TeacherStudentDetailResponse.builder().profile(profile).performance(performance).recentActivity(recentActivity)
				.strengths(strengths).improvementAreas(improvements).achievements(achievements)
				.practiceStatistics(practiceStatistics).weeklyCompletion(weeklyCompletion).currentStreak(currentStreak)
				.lastPracticeDate(lastPracticeDate)
				.standard(std != null ? std : "")
				.division(div != null ? div : "")
				.rollNumber(student.getRollNumber() != null ? student.getRollNumber() : "")
				.schoolName(schoolName != null ? schoolName : "")
				.attendanceRate(attendanceRate)
				.latestSpeakingSession(latestSpeakingDetail)
				.build();
	}

	@Override
	public TeacherAnalyticsResponse getAnalytics() {
		return getAnalytics(null, null, null);
	}

	@Override
	public TeacherAnalyticsResponse getAnalytics(Long classId, String standard, String division) {
		User teacher = getCurrentTeacher();
		List<ClassRoom> classes = getTeacherClasses(teacher.getId());

		// 1. Gather all assigned classes for this teacher
		Map<String, AssignedClassResponse> assignedClassMap = buildTeacherAssignedClassMap(teacher, classes, null);
		List<AssignedClassResponse> assignedClasses = new ArrayList<>(assignedClassMap.values());

		if (assignedClasses.isEmpty()) {
			return TeacherAnalyticsResponse.builder()
					.assignedClasses(Collections.emptyList())
					.classPerformance(Collections.emptyList())
					.studentProgress(Collections.emptyList())
					.performanceTrends(Collections.emptyList())
					.topPerformers(Collections.emptyList())
					.studentsRequiringAttention(Collections.emptyList())
					.build();
		}

		// 2. Validate and resolve selected class
		AssignedClassResponse selectedClass = null;
		if (classId != null) {
			selectedClass = assignedClasses.stream()
					.filter(c -> c.getId() != null && c.getId().equals(classId))
					.findFirst()
					.orElseThrow(() -> new AccessDeniedException("Access denied: Selected class is not assigned to your schedule"));
		} else if (standard != null && !standard.trim().isEmpty()) {
			String normRequestedStd = normalizeStandard(standard);
			String normRequestedDiv = division != null ? division.trim().toUpperCase() : "";
			selectedClass = assignedClasses.stream()
					.filter(c -> {
						String cStd = normalizeStandard(c.getStandard() != null ? c.getStandard() : c.getGrade());
						String cDiv = c.getDivision() != null ? c.getDivision().trim().toUpperCase() : "";
						boolean stdMatches = cStd.equals(normRequestedStd);
						boolean divMatches = normRequestedDiv.isEmpty() || normRequestedDiv.equalsIgnoreCase(cDiv);
						return stdMatches && divMatches;
					})
					.findFirst()
					.orElseThrow(() -> new AccessDeniedException("Access denied: Standard/division is not assigned to your schedule"));
		} else {
			// Default to first assigned class
			selectedClass = assignedClasses.get(0);
		}

		Long selectedClassId = selectedClass.getId();
		String selectedStd = selectedClass.getStandard() != null ? selectedClass.getStandard() : selectedClass.getGrade();
		String selectedDiv = selectedClass.getDivision() != null ? selectedClass.getDivision().trim().toUpperCase() : "";
		String selectedClassName = selectedClass.getName() != null ? selectedClass.getName() : formatStandardGradeAndDiv(selectedStd, selectedDiv);

		// 3. Filter teacher students strictly for this selected class (Never combine standards/divisions)
		List<User> students = getStudentsInClassesFiltered(classes, null, null, selectedStd, selectedDiv);

		// 4. Calculate individual student analytics and class aggregates
		List<StudentAnalyticsSummaryResponse> studentProgressList = new ArrayList<>();
		double totalSpeakingScores = 0;
		int speakingScoreCount = 0;
		double totalGrammarScores = 0;
		int grammarScoreCount = 0;
		double totalVocabularyWords = 0;
		int vocabularyCount = 0;
		double totalListeningScores = 0;
		int listeningScoreCount = 0;

		double totalStudentScores = 0;
		double totalStudentProgress = 0;
		double totalStudentPracticeCompletion = 0;

		long activeStudentsCount = 0;
		long practicingStudentsCount = 0;

		LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);

		for (User student : students) {
			Progress p = progressRepository.findByUser(student).orElse(null);
			Double sp = getAverageSpeakingScore(student);
			Double gr = getAverageGrammarScore(student);
			Double ls = getAverageListeningScore(student);
			Double voc = p != null && p.getTotalVocabularyWords() != null ? p.getTotalVocabularyWords().doubleValue() : 0.0;

			if (sp != null) {
				totalSpeakingScores += sp;
				speakingScoreCount++;
			}
			if (gr != null) {
				totalGrammarScores += gr;
				grammarScoreCount++;
			}
			if (ls != null) {
				totalListeningScores += ls;
				listeningScoreCount++;
			}
			if (voc > 0) {
				totalVocabularyWords += voc;
				vocabularyCount++;
			}

			// Individual student score: average of available skill scores
			List<Double> validScores = new ArrayList<>();
			if (sp != null) validScores.add(sp);
			if (gr != null) validScores.add(gr);
			if (ls != null) validScores.add(ls);

			double avgStudentScore = validScores.isEmpty()
					? (p != null && p.getXp() != null ? Math.min(100.0, p.getXp().doubleValue()) : 0.0)
					: validScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

			int completedLessons = (int) lessonProgressRepository.countByUserIdAndCompletedTrue(student.getId());
			double practiceCompletion = Math.min(100.0, completedLessons > 0 ? completedLessons * 10.0 : (p != null && p.getXp() != null ? Math.min(100.0, p.getXp() * 0.8) : 0.0));
			double overallProgress = p != null && p.getXp() != null ? Math.min(100.0, p.getXp().doubleValue()) : practiceCompletion;

			// Attendance rate for student
			boolean isActive = student.getStatus() == Status.ACTIVE;
			if (isActive) activeStudentsCount++;

			int weeklySessions = (int) speakingSessionRepository.countByUserIdAndCompletedTrueAndCreatedAtBetween(student.getId(), sevenDaysAgo, LocalDateTime.now());
			int weeklyGrammar = (int) grammarHistoryRepository.countByUserIdAndCreatedAtBetween(student.getId(), sevenDaysAgo, LocalDateTime.now());
			boolean practicedThisWeek = (weeklySessions > 0 || weeklyGrammar > 0);
			if (practicedThisWeek) practicingStudentsCount++;

			double studentAttendance = isActive ? (practicedThisWeek ? 100.0 : 75.0) : 0.0;

			studentProgressList.add(StudentAnalyticsSummaryResponse.builder()
					.studentId(student.getId())
					.studentName(((student.getFirstName() != null ? student.getFirstName() : "") + " " + (student.getLastName() != null ? student.getLastName() : "")).trim())
					.rollNumber(student.getRollNumber())
					.standard(student.getStandard())
					.division(student.getDivision())
					.overallProgress(Math.round(overallProgress * 10.0) / 10.0)
					.averageScore(Math.round(avgStudentScore * 10.0) / 10.0)
					.practiceCompletion(Math.round(practiceCompletion * 10.0) / 10.0)
					.attendance(Math.round(studentAttendance * 10.0) / 10.0)
					.status(student.getStatus() != null ? student.getStatus().name() : "ACTIVE")
					.build());

			totalStudentScores += avgStudentScore;
			totalStudentProgress += overallProgress;
			totalStudentPracticeCompletion += practiceCompletion;
		}

		int totalStudents = students.size();
		double classAvgScore = totalStudents > 0 ? (totalStudentScores / totalStudents) : 0.0;
		double classAvgProgress = totalStudents > 0 ? (totalStudentProgress / totalStudents) : 0.0;
		double classAvgPracticeCompletion = totalStudents > 0 ? (totalStudentPracticeCompletion / totalStudents) : 0.0;
		double classAttendanceRate = totalStudents > 0 ? (practicingStudentsCount * 100.0 / totalStudents) : 0.0;
		if (classAttendanceRate == 0 && activeStudentsCount > 0 && totalStudents > 0) {
			classAttendanceRate = (activeStudentsCount * 100.0 / totalStudents);
		}

		// Update student count in assignedClasses for this selected class
		final int currentClassStudentCount = totalStudents;
		assignedClasses.forEach(c -> {
			if (c.getId() != null && c.getId().equals(selectedClassId)) {
				c.setStudentCount(currentClassStudentCount);
			}
		});

		// 4 Cards data
		List<ClassPerformanceResponse> classPerformance = List.of(
				ClassPerformanceResponse.builder()
						.classId(selectedClassId)
						.className(selectedClassName)
						.grade(selectedStd)
						.totalStudents(totalStudents)
						.averageScore(classAvgScore)
						.averageProgress(classAvgProgress)
						.completedLessons((int) totalStudentPracticeCompletion)
						.activeStudents((int) activeStudentsCount)
						.build()
		);

		// Skill performance summary
		double avgSpeaking = speakingScoreCount > 0 ? (totalSpeakingScores / speakingScoreCount) : (classAvgScore > 0 ? classAvgScore : 0.0);
		double avgGrammar = grammarScoreCount > 0 ? (totalGrammarScores / grammarScoreCount) : (classAvgScore > 0 ? classAvgScore : 0.0);
		double avgListening = listeningScoreCount > 0 ? (totalListeningScores / listeningScoreCount) : (classAvgScore > 0 ? classAvgScore : 0.0);
		double avgVocabulary = vocabularyCount > 0 ? (totalVocabularyWords / vocabularyCount) : (classAvgScore > 0 ? classAvgScore : 0.0);

		SkillPerformanceSummaryResponse skillPerformance = SkillPerformanceSummaryResponse.builder()
				.speaking(avgSpeaking)
				.grammar(avgGrammar)
				.listening(avgListening)
				.vocabulary(avgVocabulary)
				.build();

		// Trends
		List<PerformanceTrendResponse> performanceTrends = new ArrayList<>();
		String[] periods = { "Week 1", "Week 2", "Week 3", "Week 4" };
		for (int i = 0; i < periods.length; i++) {
			double trendScore = Math.max(0.0, Math.min(100.0, classAvgScore + (i * 2.5) - 3.0));
			performanceTrends.add(PerformanceTrendResponse.builder()
					.period(periods[i])
					.averageScore(trendScore)
					.sessionsCompleted(totalStudents > 0 ? Math.max(1, (totalStudents * (i + 1)) / 3) : 0)
					.lessonsCompleted(totalStudents > 0 ? Math.max(1, (totalStudents * (i + 1)) / 2) : 0)
					.build());
		}

		// Top performers (require minimum score threshold >= 60.0% so students requiring attention are excluded)
		List<TopPerformerResponse> topPerformers = studentProgressList.stream()
				.filter(sp -> sp.getAverageScore() != null && sp.getAverageScore() >= 60.0)
				.sorted((a, b) -> Double.compare(b.getAverageScore() != null ? b.getAverageScore() : 0.0, a.getAverageScore() != null ? a.getAverageScore() : 0.0))
				.limit(5)
				.map(sp -> TopPerformerResponse.builder()
						.studentId(sp.getStudentId())
						.studentName(sp.getStudentName())
						.score(sp.getAverageScore())
						.metric("Average Score")
						.build())
				.collect(Collectors.toList());

		// Students requiring attention
		List<StudentAttentionItemResponse> attentionStudents = new ArrayList<>();
		for (StudentAnalyticsSummaryResponse sp : studentProgressList) {
			List<String> reasons = new ArrayList<>();
			String severity = "low";

			if (sp.getAverageScore() != null && sp.getAverageScore() < 50) {
				reasons.add("Low average score");
				severity = "high";
			}
			if (sp.getPracticeCompletion() != null && sp.getPracticeCompletion() < 40) {
				reasons.add("Low practice completion");
				if (!"high".equals(severity)) severity = "medium";
			}
			if (sp.getAttendance() != null && sp.getAttendance() < 50) {
				reasons.add("Inconsistent practice attendance");
				severity = "high";
			}
			if ("INACTIVE".equalsIgnoreCase(sp.getStatus())) {
				reasons.add("Account inactive");
				severity = "high";
			}

			if (!reasons.isEmpty()) {
				int realProg = (sp.getAverageScore() != null && sp.getAverageScore() > 0)
						? (int) Math.round(sp.getAverageScore())
						: (sp.getOverallProgress() != null ? (int) Math.round(sp.getOverallProgress()) : 0);
				attentionStudents.add(StudentAttentionItemResponse.builder()
						.studentId(sp.getStudentId())
						.studentName(sp.getStudentName())
						.reason(String.join(", ", reasons))
						.severity(severity)
						.progress(realProg)
						.score(sp.getAverageScore())
						.build());
			}
		}

		attentionStudents.sort((a, b) -> Integer.compare(getSeverityOrder(b.getSeverity()), getSeverityOrder(a.getSeverity())));

		// AI Learning Insights
		List<AiLearningInsightResponse> aiInsights = new ArrayList<>();
		if (totalStudents > 0) {
			aiInsights.add(AiLearningInsightResponse.builder()
					.insight(String.format("%s performance average is at %.0f%% with %d active students.", selectedClassName, classAvgScore, activeStudentsCount))
					.type("overview").recommendation("Focus on consistent weekly speaking drills.").build());
			aiInsights.add(AiLearningInsightResponse.builder()
					.insight(String.format("Speaking proficiency average is %.0f%% across current learners.", avgSpeaking))
					.type("speaking").recommendation("Introduce interactive conversation topics.").build());
		}

		return TeacherAnalyticsResponse.builder()
				.assignedClasses(assignedClasses)
				.selectedClassId(selectedClassId)
				.selectedStandard(selectedStd)
				.selectedDivision(selectedDiv)
				.selectedClassName(selectedClassName)
				.classPerformance(classPerformance)
				.studentProgress(studentProgressList)
				.skillPerformance(skillPerformance)
				.performanceTrends(performanceTrends)
				.topPerformers(topPerformers)
				.studentsRequiringAttention(attentionStudents)
				.aiLearningInsights(aiInsights)
				.build();
	}

	@Override
	public TeacherStudentDetailResponse getStudentAnalytics(Long studentId) {
		return getStudentDetail(studentId);
	}

	@Override
	public TeacherReportsResponse getReports() {
		User teacher = getCurrentTeacher();
		List<ClassRoom> classes = getTeacherClasses(teacher.getId());
		List<User> students = getStudentsInClasses(classes);

		List<ReportCategoryResponse> reportCategories = List.of(
				ReportCategoryResponse.builder().id("class").name("Class Performance")
						.description("Detailed performance analysis per class").icon("bar-chart").build(),
				ReportCategoryResponse.builder().id("student").name("Student Progress")
						.description("Individual student progress reports").icon("person").build(),
				ReportCategoryResponse.builder().id("skill").name("Skill Analysis")
						.description("Grammar, vocabulary, speaking and listening analytics").icon("trending-up")
						.build(),
				ReportCategoryResponse.builder().id("attendance").name("Attendance Report")
						.description("Student attendance and participation tracking").icon("calendar").build());

		List<RecentReportResponse> recentReports = List.of(
				RecentReportResponse.builder().id("rpt-001").title("Class Performance - Grade 10A").type("class")
						.status("completed").generatedAt(LocalDateTime.now().minusDays(1)).downloadUrl("/reports/rpt-001")
						.build(),
				RecentReportResponse.builder().id("rpt-002").title("Student Progress - Monthly").type("student")
						.status("completed").generatedAt(LocalDateTime.now().minusDays(3)).downloadUrl("/reports/rpt-002")
						.build(),
				RecentReportResponse.builder().id("rpt-003").title("Skill Analysis - Q3").type("skill")
						.status("processing").generatedAt(LocalDateTime.now().minusHours(5)).downloadUrl(null).build());

		ReportStatusResponse reportStatus = ReportStatusResponse.builder().pending("1").completed("2").failed("0").build();

		double avgProgress = 0;
		if (!students.isEmpty()) {
			double totalXp = students.stream().mapToDouble(s -> {
				Progress p = progressRepository.findByUser(s).orElse(null);
				return p != null && p.getXp() != null ? p.getXp() : 0;
			}).sum();
			avgProgress = totalXp / students.size();
		}

		StatisticsResponse performanceSummary = StatisticsResponse.builder()
				.totalLessons((int) lessonProgressRepository.countByUserIdAndCompletedTrue(teacher.getId()))
				.completedLessons((int) lessonProgressRepository.countByUserIdAndCompletedTrue(teacher.getId()))
				.speakingSessions((int) speakingSessionRepository.countByUserIdAndCreatedAtBetween(teacher.getId(),
						LocalDateTime.now().minusYears(100), LocalDateTime.now()))
				.vocabularyLearned((int) vocabularyRepository.findByUser(teacher).stream().count())
				.grammarExercises((int) grammarHistoryRepository.countByUserIdAndCreatedAtBetween(teacher.getId(),
						LocalDateTime.now().minusYears(100), LocalDateTime.now()))
				.totalStudyHours(0.0).currentStreak(0).longestStreak(0).averageScore((int) Math.round(avgProgress))
				.build();

		List<UpcomingReportResponse> upcomingReports = List.of(
				UpcomingReportResponse.builder().id("rpt-upcoming-1").title("Monthly Progress Report").type("student")
						.dueDate(LocalDate.now().plusDays(5)).status("scheduled").build(),
				UpcomingReportResponse.builder().id("rpt-upcoming-2").title("Term End Assessment").type("class")
						.dueDate(LocalDate.now().plusDays(20)).status("scheduled").build());

		LocalDate today = LocalDate.now();
		LocalDate sessionStart = LocalDate.of(today.getYear(), 6, 1);
		LocalDate sessionEnd = LocalDate.of(today.getYear() + 1, 5, 31);
		long weeksBetween = java.time.temporal.ChronoUnit.WEEKS.between(today, sessionEnd);
		AcademicSessionResponse academicSession = AcademicSessionResponse.builder().name("2025-2026")
				.startDate(sessionStart).endDate(sessionEnd).currentTerm("Term 1")
				.totalWeeks(52)
				.remainingWeeks((int) weeksBetween).build();

		return TeacherReportsResponse.builder().reportCategories(reportCategories).recentReports(recentReports)
				.reportStatus(reportStatus).performanceSummary(performanceSummary).upcomingReports(upcomingReports)
				.academicSession(academicSession).build();
	}

	private String formatStandardGradeAndDiv(String std, String div) {
		if (std == null || std.trim().isEmpty()) return "";
		String normStd = normalizeStandard(std);
		if (normStd.isEmpty()) normStd = std.trim();
		String formattedStd = "Grade " + normStd;

		if (div != null && !div.trim().isEmpty()) {
			return formattedStd + " - " + div.trim().toUpperCase();
		}
		return formattedStd;
	}

	private Map<String, AssignedClassResponse> buildTeacherAssignedClassMap(User teacher, List<ClassRoom> classes, List<User> students) {
		Map<String, AssignedClassResponse> assignedClassMap = new LinkedHashMap<>();

		// 1. Primary & canonical source: TeacherStandardDivision records
		if (teacher != null && teacher.getId() != null && teacherStandardDivisionRepository != null) {
			List<TeacherStandardDivision> teacherStdDivs = teacherStandardDivisionRepository.findByTeacherId(teacher.getId());
			if (teacherStdDivs != null && !teacherStdDivs.isEmpty()) {
				for (TeacherStandardDivision tsd : teacherStdDivs) {
					if (tsd.getStandardDivision() != null && tsd.getStandardDivision().getSchoolStandard() != null) {
						String std = tsd.getStandardDivision().getSchoolStandard().getStandard();
						String div = tsd.getStandardDivision().getDivision();
						String normStd = normalizeStandard(std);
						String normDiv = div != null ? div.trim().toUpperCase() : "";
						String key = normStd + "_" + normDiv;

						if (!assignedClassMap.containsKey(key)) {
							String formatted = formatStandardGradeAndDiv(normStd, normDiv);

							ClassRoom matchingRoom = null;
							if (classes != null) {
								matchingRoom = classes.stream()
										.filter(c -> normalizeStandard(c.getGrade()).equals(normStd)
												&& ((c.getDivision() == null && normDiv.isEmpty())
														|| (c.getDivision() != null && c.getDivision().trim().equalsIgnoreCase(normDiv))))
										.findFirst().orElse(null);
							}

							int sCount = 0;
							if (matchingRoom != null) {
								List<ClassStudent> classStudents = classStudentRepository.findByClassId(matchingRoom.getId());
								sCount = classStudents != null ? classStudents.size() : 0;
							}
							if (sCount == 0 && students != null) {
								sCount = (int) students.stream().filter(s -> {
									boolean stdMatch = normStd.equals(normalizeStandard(s.getStandard()));
									boolean divMatch = normDiv.isEmpty() || normDiv.equalsIgnoreCase(s.getDivision() != null ? s.getDivision().trim() : "");
									return stdMatch && divMatch;
								}).count();
							}

							assignedClassMap.put(key, AssignedClassResponse.builder()
									.id(matchingRoom != null ? matchingRoom.getId() : tsd.getId())
									.name(formatted)
									.grade(normStd)
									.standard(normStd)
									.division(normDiv)
									.academicYear(matchingRoom != null && matchingRoom.getAcademicYear() != null ? matchingRoom.getAcademicYear() : "2025-2026")
									.status(matchingRoom != null && matchingRoom.getStatus() != null ? matchingRoom.getStatus() : Status.ACTIVE)
									.studentCount(sCount)
									.build());
						}
					}
				}
				return assignedClassMap;
			}
		}

		// 2. Fallback to ClassRoom entities ONLY if no TeacherStandardDivision records exist
		if (classes != null) {
			for (ClassRoom c : classes) {
				String std = c.getGrade();
				String div = c.getDivision();
				String normStd = normalizeStandard(std);
				String normDiv = div != null ? div.trim().toUpperCase() : "";
				String key = normStd + "_" + normDiv;

				if (!assignedClassMap.containsKey(key)) {
					String formatted = formatStandardGradeAndDiv(normStd, normDiv);
					List<ClassStudent> classStudents = classStudentRepository.findByClassId(c.getId());
					int sCount = classStudents != null ? classStudents.size() : 0;
					if (sCount == 0 && students != null) {
						sCount = (int) students.stream().filter(s -> {
							boolean stdMatch = normStd.equals(normalizeStandard(s.getStandard()));
							boolean divMatch = normDiv.isEmpty() || normDiv.equalsIgnoreCase(s.getDivision() != null ? s.getDivision().trim() : "");
							return stdMatch && divMatch;
						}).count();
					}

					assignedClassMap.put(key, AssignedClassResponse.builder()
							.id(c.getId())
							.name(formatted)
							.grade(normStd)
							.standard(normStd)
							.division(normDiv)
							.academicYear(c.getAcademicYear() != null ? c.getAcademicYear() : "2025-2026")
							.status(c.getStatus() != null ? c.getStatus() : Status.ACTIVE)
							.studentCount(sCount)
							.build());
				}
			}
		}

		// 3. Fallback to teacher's direct standard/division if still empty
		if (assignedClassMap.isEmpty() && teacher != null && teacher.getStandard() != null && !teacher.getStandard().trim().isEmpty()) {
			String std = teacher.getStandard().trim();
			String div = teacher.getDivision() != null ? teacher.getDivision().trim().toUpperCase() : "";
			String normStd = normalizeStandard(std);
			String formatted = formatStandardGradeAndDiv(normStd, div);
			assignedClassMap.put("fallback", AssignedClassResponse.builder()
					.id(teacher.getId())
					.name(formatted)
					.grade(normStd)
					.standard(normStd)
					.division(div)
					.academicYear("2025-2026")
					.status(Status.ACTIVE)
					.studentCount(students != null ? students.size() : 0)
					.build());
		}

		return assignedClassMap;
	}

	@Override
	public TeacherProfileResponse getProfile() {
		Teacher teacher = getAuthenticatedTeacher();
		com.rslsolution.speakmateai.entity.Settings settings = settingsRepository.findByUser(teacher).orElse(null);

		List<ClassRoom> classes = getTeacherClasses(teacher.getId());
		ResolvedTeacherSchool resolvedSchool = resolveTeacherSchool(teacher, classes);
		String resolvedSchoolName = resolvedSchool.name;
		Long resolvedSchoolId = resolvedSchool.id;

		// Resolve Assigned Classes
		Map<String, AssignedClassResponse> profileClassMap = buildTeacherAssignedClassMap(teacher, classes, null);
		List<String> formattedStandards = new ArrayList<>();
		for (AssignedClassResponse ac : profileClassMap.values()) {
			if (ac.getName() != null && !ac.getName().trim().isEmpty() && !formattedStandards.contains(ac.getName().trim())) {
				formattedStandards.add(ac.getName().trim());
			}
		}

		formattedStandards.sort(Comparator.naturalOrder());
		String assignedStandardString = formattedStandards.isEmpty() ? null : String.join(", ", formattedStandards);
		List<AssignedClassResponse> assignedClasses = new ArrayList<>(profileClassMap.values());

		IdentityResponse identity = IdentityResponse.builder()
				.id(teacher.getId())
				.firstName(teacher.getFirstName())
				.lastName(teacher.getLastName())
				.email(teacher.getEmail())
				.avatar(teacher.getAvatar())
				.role(teacher.getRole().name())
				.active(teacher.isActive())
				.standard(assignedStandardString)
				.schoolName(resolvedSchoolName)
				.build();

		ProfessionalInfoResponse professionalInfo = ProfessionalInfoResponse.builder()
				.employeeId(teacher.getEmployeeId())
				.department(teacher.getDepartment())
				.designation(teacher.getDesignation())
				.qualification(teacher.getQualification())
				.experience(teacher.getExperience())
				.joinedAt(teacher.getJoinedAt() != null ? teacher.getJoinedAt() : teacher.getCreatedAt())
				.bio(teacher.getBio())
				.build();

		List<User> students = getTeacherStudents(teacher, classes);
		int totalLessonsAssigned = 0;

		TeachingOverviewResponse teachingOverview = TeachingOverviewResponse.builder()
				.totalClasses(classes != null ? classes.size() : 0)
				.totalStudents(students.size())
				.totalLessonsAssigned(totalLessonsAssigned)
				.averageClassPerformance(0.0)
				.assignedClasses(assignedClasses)
				.build();

		ContactInfoResponse contactInfo = ContactInfoResponse.builder()
				.phone(teacher.getPhone())
				.alternatePhone(null)
				.location(teacher.getLocation())
				.address(teacher.getLocation() != null ? teacher.getLocation() : resolvedSchoolName)
				.city(null).state(null).country(null).build();

		AccountInfoResponse accountInfo = AccountInfoResponse.builder()
				.active(teacher.isActive())
				.emailVerified(teacher.isEmailVerified())
				.createdAt(teacher.getCreatedAt())
				.updatedAt(teacher.getUpdatedAt())
				.lastLogin(null).build();

		UserPreferencesResponse userPreferences = UserPreferencesResponse.builder()
				.darkMode(settings != null ? settings.getDarkMode() : false)
				.notificationsEnabled(settings != null ? settings.getNotificationsEnabled() : true)
				.language(settings != null ? settings.getLanguage() : "English")
				.aiVoice(settings != null ? settings.getAiVoice() : "Female")
				.soundEffects(settings != null ? settings.getSoundEffects() : true)
				.autoPlayAudio(settings != null ? settings.getAutoPlayAudio() : true)
				.dailyReminder(settings != null ? settings.getDailyReminder() : true).build();

		return TeacherProfileResponse.builder()
				.identity(identity)
				.professionalInfo(professionalInfo)
				.teachingOverview(teachingOverview)
				.contactInfo(contactInfo)
				.accountInfo(accountInfo)
				.userPreferences(userPreferences)
				.bio(teacher.getBio())
				.schoolId(resolvedSchoolId)
				.schoolName(resolvedSchoolName)
				.assignedStandard(assignedStandardString)
				.build();
	}

	@Override
	public TeacherProfileResponse updateProfile(TeacherProfileUpdateRequest request) {
		Teacher teacher = getAuthenticatedTeacher();

		teacher.setFirstName(request.getFirstName().trim());
		teacher.setLastName(request.getLastName().trim());

		if (request.getPhone() != null && !request.getPhone().trim().isEmpty()) {
			teacher.setPhone(com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getPhone(), "Phone number"));
		} else {
			teacher.setPhone(null);
		}

		teacher.setDepartment(request.getDepartment() != null ? request.getDepartment().trim() : null);
		teacher.setDesignation(request.getDesignation() != null ? request.getDesignation().trim() : null);
		teacher.setQualification(request.getQualification() != null ? request.getQualification().trim() : null);
		teacher.setExperience(request.getExperience() != null ? request.getExperience().trim() : null);
		teacher.setLocation(request.getLocation() != null ? request.getLocation().trim() : null);
		teacher.setBio(request.getBio() != null ? request.getBio().trim() : null);
		if (request.getAvatar() != null) {
			teacher.setAvatar(request.getAvatar().trim().isEmpty() ? null : request.getAvatar().trim());
		}

		teacherRepository.save(teacher);
		teacherRepository.flush();
		userRepository.flush();
		return getProfile();
	}

	@Override
	public TeacherProfileResponse updateAvatar(String avatar) {
		Teacher teacher = getAuthenticatedTeacher();
		teacher.setAvatar(avatar != null && !avatar.trim().isEmpty() ? avatar.trim() : null);
		teacherRepository.save(teacher);
		teacherRepository.flush();
		userRepository.flush();
		return getProfile();
	}

	@Override
	public void changePassword(ChangePasswordRequest request) {
		Teacher teacher = getAuthenticatedTeacher();

		if (!passwordEncoder.matches(request.getCurrentPassword(), teacher.getPassword())) {
			throw new IllegalArgumentException("Current password is incorrect");
		}

		if (!request.getNewPassword().equals(request.getConfirmPassword())) {
			throw new IllegalArgumentException("New password and confirm password do not match");
		}

		teacher.setPassword(passwordEncoder.encode(request.getNewPassword()));
		teacherRepository.save(teacher);
	}

	@Override
	public byte[] downloadProfile() {
		TeacherProfileResponse profile = getProfile();
		try {
			com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
			mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
			return mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(profile);
		} catch (Exception e) {
			throw new RuntimeException("Failed to generate profile download", e);
		}
	}

	@Override
	public byte[] downloadStudentReport(Long studentId, String format) {
		TeacherStudentDetailResponse studentDetail = getStudentDetail(studentId);
		if (studentDetail == null) {
			throw new IllegalArgumentException("Student not found or unauthorized for student ID: " + studentId);
		}

		String reqFormat = format != null ? format.toLowerCase(java.util.Locale.ROOT) : "pdf";
		if ("json".equals(reqFormat)) {
			try {
				com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
				mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
				return mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(studentDetail);
			} catch (Exception e) {
				throw new RuntimeException("Failed to generate report JSON", e);
			}
		}

		if ("csv".equals(reqFormat)) {
			StringBuilder sb = new StringBuilder();
			sb.append("Student ID,Name,Standard,Division,Roll Number,School,Attendance Rate,Lessons Completed,Grammar Score,Vocabulary Score,Speaking Score,Listening Score,Practice Sessions,Total Practice Minutes\n");
			String name = studentDetail.getProfile() != null
					? (studentDetail.getProfile().getFirstName() + " " + (studentDetail.getProfile().getLastName() != null ? studentDetail.getProfile().getLastName() : "")).trim()
					: "Student #" + studentId;
			sb.append(studentId).append(",")
					.append("\"").append(name).append("\",")
					.append("\"").append(studentDetail.getStandard() != null ? studentDetail.getStandard() : "").append("\",")
					.append("\"").append(studentDetail.getDivision() != null ? studentDetail.getDivision() : "").append("\",")
					.append("\"").append(studentDetail.getRollNumber() != null ? studentDetail.getRollNumber() : "").append("\",")
					.append("\"").append(studentDetail.getSchoolName() != null ? studentDetail.getSchoolName() : "").append("\",")
					.append(studentDetail.getAttendanceRate() != null ? studentDetail.getAttendanceRate() : 0).append(",")
					.append(studentDetail.getPerformance() != null && studentDetail.getPerformance().getLessonsCompleted() != null ? studentDetail.getPerformance().getLessonsCompleted() : 0).append(",")
					.append(studentDetail.getPerformance() != null && studentDetail.getPerformance().getGrammarScore() != null ? Math.round(studentDetail.getPerformance().getGrammarScore()) : 0).append(",")
					.append(studentDetail.getPerformance() != null && studentDetail.getPerformance().getVocabularyScore() != null ? Math.round(studentDetail.getPerformance().getVocabularyScore()) : 0).append(",")
					.append(studentDetail.getPerformance() != null && studentDetail.getPerformance().getSpeakingScore() != null ? Math.round(studentDetail.getPerformance().getSpeakingScore()) : 0).append(",")
					.append(studentDetail.getPerformance() != null && studentDetail.getPerformance().getListeningScore() != null ? Math.round(studentDetail.getPerformance().getListeningScore()) : 0).append(",")
					.append(studentDetail.getPracticeStatistics() != null && studentDetail.getPracticeStatistics().getCompletedSpeakingSessions() != null ? studentDetail.getPracticeStatistics().getCompletedSpeakingSessions() : 0).append(",")
					.append(studentDetail.getPracticeStatistics() != null && studentDetail.getPracticeStatistics().getTotalPracticeMinutes() != null ? studentDetail.getPracticeStatistics().getTotalPracticeMinutes() : 0).append("\n");
			return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
		}

		return generatePdfStudentReport(studentDetail, studentId);
	}

	private byte[] generatePdfStudentReport(TeacherStudentDetailResponse studentDetail, Long studentId) {
		try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
			com.itextpdf.text.Document document = new com.itextpdf.text.Document(com.itextpdf.text.PageSize.A4, 36, 36, 36, 36);
			com.itextpdf.text.pdf.PdfWriter.getInstance(document, out);
			document.open();

			com.itextpdf.text.Font headerFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA_BOLD, 18, new com.itextpdf.text.BaseColor(49, 46, 129));
			com.itextpdf.text.Font subFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA, 10, com.itextpdf.text.BaseColor.GRAY);
			com.itextpdf.text.Font sectionFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA_BOLD, 12, new com.itextpdf.text.BaseColor(15, 23, 42));
			com.itextpdf.text.Font bodyFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA, 10, com.itextpdf.text.BaseColor.DARK_GRAY);
			com.itextpdf.text.Font boldBodyFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA_BOLD, 10, com.itextpdf.text.BaseColor.BLACK);

			document.add(new com.itextpdf.text.Paragraph("SPEAKMATE AI - STUDENT EVALUATION REPORT", headerFont));
			document.add(new com.itextpdf.text.Paragraph("Generated on: " + LocalDateTime.now().toString(), subFont));
			document.add(new com.itextpdf.text.Paragraph(" "));

			// Student Info Section
			document.add(new com.itextpdf.text.Paragraph("STUDENT INFORMATION", sectionFont));
			document.add(new com.itextpdf.text.Paragraph(" "));

			com.itextpdf.text.pdf.PdfPTable infoTable = new com.itextpdf.text.pdf.PdfPTable(2);
			infoTable.setWidthPercentage(100);

			String name = studentDetail.getProfile() != null
					? (studentDetail.getProfile().getFirstName() + " " + (studentDetail.getProfile().getLastName() != null ? studentDetail.getProfile().getLastName() : "")).trim()
					: "Student #" + studentId;

			addCellToTable(infoTable, "Student Name:", name, boldBodyFont, bodyFont);
			addCellToTable(infoTable, "Student ID:", String.valueOf(studentId), boldBodyFont, bodyFont);
			addCellToTable(infoTable, "Standard:", studentDetail.getStandard() != null ? studentDetail.getStandard() : "-", boldBodyFont, bodyFont);
			addCellToTable(infoTable, "Division:", studentDetail.getDivision() != null ? studentDetail.getDivision() : "-", boldBodyFont, bodyFont);
			addCellToTable(infoTable, "Roll Number:", studentDetail.getRollNumber() != null ? studentDetail.getRollNumber() : "-", boldBodyFont, bodyFont);
			addCellToTable(infoTable, "School Name:", studentDetail.getSchoolName() != null ? studentDetail.getSchoolName() : "SpeakMate Partner School", boldBodyFont, bodyFont);

			document.add(infoTable);
			document.add(new com.itextpdf.text.Paragraph(" "));

			// Performance Section
			document.add(new com.itextpdf.text.Paragraph("PERFORMANCE EVALUATION", sectionFont));
			document.add(new com.itextpdf.text.Paragraph(" "));

			com.itextpdf.text.pdf.PdfPTable perfTable = new com.itextpdf.text.pdf.PdfPTable(2);
			perfTable.setWidthPercentage(100);

			addCellToTable(perfTable, "Attendance Rate:", studentDetail.getAttendanceRate() != null ? studentDetail.getAttendanceRate() + "%" : "N/A", boldBodyFont, bodyFont);
			if (studentDetail.getPerformance() != null) {
				addCellToTable(perfTable, "Lessons Completed:", String.valueOf(studentDetail.getPerformance().getLessonsCompleted() != null ? studentDetail.getPerformance().getLessonsCompleted() : 0), boldBodyFont, bodyFont);
				addCellToTable(perfTable, "Grammar Score:", (studentDetail.getPerformance().getGrammarScore() != null ? Math.round(studentDetail.getPerformance().getGrammarScore()) : 0) + "%", boldBodyFont, bodyFont);
				addCellToTable(perfTable, "Vocabulary Score:", (studentDetail.getPerformance().getVocabularyScore() != null ? Math.round(studentDetail.getPerformance().getVocabularyScore()) : 0) + "%", boldBodyFont, bodyFont);
				addCellToTable(perfTable, "Speaking Score:", (studentDetail.getPerformance().getSpeakingScore() != null ? Math.round(studentDetail.getPerformance().getSpeakingScore()) : 0) + "%", boldBodyFont, bodyFont);
				addCellToTable(perfTable, "Listening Score:", (studentDetail.getPerformance().getListeningScore() != null ? Math.round(studentDetail.getPerformance().getListeningScore()) : 0) + "%", boldBodyFont, bodyFont);
			}

			document.add(perfTable);

			if (studentDetail.getPracticeStatistics() != null) {
				document.add(new com.itextpdf.text.Paragraph(" "));
				document.add(new com.itextpdf.text.Paragraph("PRACTICE STATISTICS", sectionFont));
				document.add(new com.itextpdf.text.Paragraph(" "));

				com.itextpdf.text.pdf.PdfPTable statsTable = new com.itextpdf.text.pdf.PdfPTable(2);
				statsTable.setWidthPercentage(100);

				addCellToTable(statsTable, "Speaking Sessions:", String.valueOf(studentDetail.getPracticeStatistics().getCompletedSpeakingSessions() != null ? studentDetail.getPracticeStatistics().getCompletedSpeakingSessions() : 0), boldBodyFont, bodyFont);
				addCellToTable(statsTable, "Practice Minutes:", (studentDetail.getPracticeStatistics().getTotalPracticeMinutes() != null ? studentDetail.getPracticeStatistics().getTotalPracticeMinutes() : 0) + " mins", boldBodyFont, bodyFont);

				document.add(statsTable);
			}

			document.close();
			return out.toByteArray();
		} catch (Exception e) {
			throw new RuntimeException("Failed to generate PDF student report", e);
		}
	}

	private void addCellToTable(com.itextpdf.text.pdf.PdfPTable table, String label, String value, com.itextpdf.text.Font boldFont, com.itextpdf.text.Font regularFont) {
		com.itextpdf.text.Phrase p = new com.itextpdf.text.Phrase();
		p.add(new com.itextpdf.text.Chunk(label + " ", boldFont));
		p.add(new com.itextpdf.text.Chunk(value, regularFont));
		com.itextpdf.text.pdf.PdfPCell cell = new com.itextpdf.text.pdf.PdfPCell(p);
		cell.setPadding(6);
		cell.setBorderColor(new com.itextpdf.text.BaseColor(226, 232, 240));
		table.addCell(cell);
	}

	@Override
	public byte[] downloadReportById(String reportId, String format) {
		User teacher = getCurrentTeacher();
		String reqFormat = format != null ? format.toLowerCase(java.util.Locale.ROOT) : "pdf";
		if ("csv".equals(reqFormat)) {
			StringBuilder sb = new StringBuilder();
			sb.append("Report ID,Teacher ID,Title,Status,Generated At\n");
			sb.append(reportId).append(",").append(teacher.getId()).append(",Summary Report,Completed,").append(LocalDateTime.now()).append("\n");
			return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
		}

		try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
			com.itextpdf.text.Document document = new com.itextpdf.text.Document(com.itextpdf.text.PageSize.A4, 36, 36, 36, 36);
			com.itextpdf.text.pdf.PdfWriter.getInstance(document, out);
			document.open();

			com.itextpdf.text.Font headerFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA_BOLD, 18, new com.itextpdf.text.BaseColor(49, 46, 129));
			com.itextpdf.text.Font bodyFont = com.itextpdf.text.FontFactory.getFont(com.itextpdf.text.FontFactory.HELVETICA, 10, com.itextpdf.text.BaseColor.DARK_GRAY);

			document.add(new com.itextpdf.text.Paragraph("SPEAKMATE AI - SUMMARY REPORT", headerFont));
			document.add(new com.itextpdf.text.Paragraph("Report ID   : " + reportId, bodyFont));
			document.add(new com.itextpdf.text.Paragraph("Teacher ID  : " + teacher.getId(), bodyFont));
			document.add(new com.itextpdf.text.Paragraph("Generated At: " + LocalDateTime.now(), bodyFont));

			document.close();
			return out.toByteArray();
		} catch (Exception e) {
			throw new RuntimeException("Failed to generate PDF summary report", e);
		}
	}

	private int extractGradeNumber(String str) {
		if (str == null) return 0;
		java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(str);
		if (m.find()) {
			try {
				return Integer.parseInt(m.group());
			} catch (Exception e) {}
		}
		return 0;
	}
}
