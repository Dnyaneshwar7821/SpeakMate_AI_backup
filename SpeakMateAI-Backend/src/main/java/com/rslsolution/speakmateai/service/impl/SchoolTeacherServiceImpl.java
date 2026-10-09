package com.rslsolution.speakmateai.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rslsolution.speakmateai.dto.request.SchoolTeacherRequest;
import com.rslsolution.speakmateai.dto.request.StandardDivisionPair;
import com.rslsolution.speakmateai.dto.response.SchoolTeacherResponse;
import com.rslsolution.speakmateai.entity.Admin;
import com.rslsolution.speakmateai.entity.ClassRoom;
import com.rslsolution.speakmateai.entity.School;
import com.rslsolution.speakmateai.entity.SchoolStandard;
import com.rslsolution.speakmateai.entity.Settings;
import com.rslsolution.speakmateai.entity.StandardDivision;
import com.rslsolution.speakmateai.entity.Teacher;
import com.rslsolution.speakmateai.entity.TeacherStandardDivision;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.NotificationType;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.enums.Status;
import com.rslsolution.speakmateai.enums.UserType;
import com.rslsolution.speakmateai.exception.UserNotFoundException;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.repository.ClassRoomRepository;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.SchoolRepository;
import com.rslsolution.speakmateai.repository.SchoolStandardRepository;
import com.rslsolution.speakmateai.repository.SettingsRepository;
import com.rslsolution.speakmateai.repository.StandardDivisionRepository;
import com.rslsolution.speakmateai.repository.TeacherRepository;
import com.rslsolution.speakmateai.repository.TeacherStandardDivisionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;
import com.rslsolution.speakmateai.service.EmailService;
import com.rslsolution.speakmateai.service.NotificationService;
import com.rslsolution.speakmateai.service.SchoolTeacherService;
import com.rslsolution.speakmateai.exception.DuplicateEmailException;
import com.rslsolution.speakmateai.exception.DuplicateAssignmentException;
import org.springframework.beans.factory.annotation.Value;

@Service
@Transactional
public class SchoolTeacherServiceImpl implements SchoolTeacherService {

	private final UserRepository userRepository;
	private final TeacherRepository teacherRepository;
	private final SchoolRepository schoolRepository;
	private final SettingsRepository settingsRepository;
	private final PasswordEncoder passwordEncoder;
	private final ClassRoomRepository classRoomRepository;
	private final SchoolStandardRepository schoolStandardRepository;
	private final StandardDivisionRepository standardDivisionRepository;
	private final TeacherStandardDivisionRepository teacherStandardDivisionRepository;
	@SuppressWarnings("unused")
	private final ProgressRepository progressRepository;
	private final AdminRepository adminRepository;
	private final NotificationService notificationService;
	private final EmailService emailService;

	@Value("${app.frontend.url:https://speak-mate-ai-nine.vercel.app}")
	private String frontendUrl;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.service.email.EmailTemplateService emailTemplateService;

	@Autowired(required = false)
	private com.rslsolution.speakmateai.service.EntityCascadeDeletionService entityCascadeDeletionService;

	@Autowired
	public SchoolTeacherServiceImpl(
			UserRepository userRepository,
			@Autowired(required = false) TeacherRepository teacherRepository,
			SchoolRepository schoolRepository,
			SettingsRepository settingsRepository,
			PasswordEncoder passwordEncoder,
			@Autowired(required = false) ClassRoomRepository classRoomRepository,
			@Autowired(required = false) SchoolStandardRepository schoolStandardRepository,
			@Autowired(required = false) StandardDivisionRepository standardDivisionRepository,
			@Autowired(required = false) TeacherStandardDivisionRepository teacherStandardDivisionRepository,
			@Autowired(required = false) ProgressRepository progressRepository,
			@Autowired(required = false) AdminRepository adminRepository,
			@Autowired(required = false) NotificationService notificationService,
			@Autowired(required = false) EmailService emailService) {
		this.userRepository = userRepository;
		this.teacherRepository = teacherRepository;
		this.schoolRepository = schoolRepository;
		this.settingsRepository = settingsRepository;
		this.passwordEncoder = passwordEncoder;
		this.classRoomRepository = classRoomRepository;
		this.schoolStandardRepository = schoolStandardRepository;
		this.standardDivisionRepository = standardDivisionRepository;
		this.teacherStandardDivisionRepository = teacherStandardDivisionRepository;
		this.progressRepository = progressRepository;
		this.adminRepository = adminRepository;
		this.notificationService = notificationService;
		this.emailService = emailService;
	}

	public SchoolTeacherServiceImpl(UserRepository userRepository, SchoolRepository schoolRepository,
			SettingsRepository settingsRepository, ProgressRepository progressRepository,
			PasswordEncoder passwordEncoder) {
		this(userRepository, null, schoolRepository, settingsRepository, passwordEncoder, null, null, null, null,
				progressRepository, null, null, null);
	}

	private User getCurrentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || authentication.getName() == null) {
			throw new UserNotFoundException("User not authenticated");
		}
		String email = authentication.getName();

		User user = userRepository.findByEmail(email).orElse(null);
		if (user != null) {
			return user;
		}

		if (adminRepository != null) {
			Admin admin = adminRepository.findByEmail(email).orElse(null);
			if (admin != null) {
				User proxyUser = new User();
				proxyUser.setId(admin.getId());
				proxyUser.setEmail(admin.getEmail());
				proxyUser.setFirstName(admin.getFullName());
				proxyUser.setRole(admin.getRole());
				proxyUser.setActive(true);
				return proxyUser;
			}
		}

		throw new UserNotFoundException("User not found: " + email);
	}

	private SchoolTeacherResponse mapToResponse(User teacher) {
		return mapToResponse(teacher, null);
	}

	private String normalizeStandard(String standard) {
		if (standard == null) {
			return null;
		}
		String clean = standard.trim();
		// E.g., "7th Standard", "7th std", "Grade 7" -> "7"
		String stripped = clean.replaceAll("(?i)(st|nd|rd|th)?\\s*(standard|std|grade|class)?$", "")
				.replaceAll("(?i)^(grade|class)\\s*", "")
				.trim();
		return stripped.isEmpty() ? clean : stripped;
	}

	private List<StandardDivisionPair> assembleAssignedPairs(Long teacherId, User teacher,
			List<TeacherStandardDivision> tsds, List<ClassRoom> rooms) {
		if (teacherId == null) {
			return Collections.emptyList();
		}
		Map<String, StandardDivisionPair> uniquePairs = new LinkedHashMap<>();

		// 1. From TeacherStandardDivision (canonical source)
		if (tsds != null) {
			for (TeacherStandardDivision tsd : tsds) {
				if (tsd != null && tsd.getStandardDivision() != null) {
					String div = tsd.getStandardDivision().getDivision();
					String std = tsd.getStandardDivision().getSchoolStandard() != null
							? tsd.getStandardDivision().getSchoolStandard().getStandard()
							: null;
					if (std != null && !std.isBlank()) {
						String normStd = normalizeStandard(std);
						String normDiv = div != null ? div.trim().toUpperCase() : "";
						String key = normStd + "-" + normDiv;
						uniquePairs.putIfAbsent(key, StandardDivisionPair.builder()
								.standard(normStd)
								.division(normDiv.isEmpty() ? null : normDiv)
								.build());
					}
				}
			}
		}

		// 2. From class_rooms (fallback only if no TeacherStandardDivision records exist)
		if (uniquePairs.isEmpty() && rooms != null) {
			for (ClassRoom room : rooms) {
				if (room != null && room.getGrade() != null && !room.getGrade().isBlank()) {
					String normStd = normalizeStandard(room.getGrade());
					String normDiv = room.getDivision() != null ? room.getDivision().trim().toUpperCase() : "";
					String key = normStd + "-" + normDiv;
					uniquePairs.putIfAbsent(key, StandardDivisionPair.builder()
							.standard(normStd)
							.division(normDiv.isEmpty() ? null : normDiv)
							.build());
				}
			}
		}

		// 3. Fallback to teacher.getStandard() / teacher.getDivision()
		if (uniquePairs.isEmpty() && teacher != null && teacher.getStandard() != null
				&& !teacher.getStandard().isBlank()) {
			String normStd = normalizeStandard(teacher.getStandard());
			String normDiv = teacher.getDivision() != null ? teacher.getDivision().trim().toUpperCase() : "";
			String key = normStd + "-" + normDiv;
			uniquePairs.putIfAbsent(key, StandardDivisionPair.builder()
					.standard(normStd)
					.division(normDiv.isEmpty() ? null : normDiv)
					.build());
		}

		return new ArrayList<>(uniquePairs.values());
	}

	private List<StandardDivisionPair> getTeacherAssignedPairs(Long teacherId, User teacher) {
		List<TeacherStandardDivision> tsds = (teacherStandardDivisionRepository != null && teacherId != null)
				? teacherStandardDivisionRepository.findByTeacherId(teacherId)
				: null;
		List<ClassRoom> rooms = (classRoomRepository != null && teacherId != null)
				? classRoomRepository.findByTeacherId(teacherId)
				: null;
		return assembleAssignedPairs(teacherId, teacher, tsds, rooms);
	}

	private List<SchoolTeacherResponse> mapTeachersToResponses(List<User> teachers) {
		if (teachers == null || teachers.isEmpty()) {
			return Collections.emptyList();
		}

		List<Long> teacherIds = teachers.stream().map(User::getId).filter(Objects::nonNull).toList();
		List<Long> schoolIds = teachers.stream().map(User::getSchoolId).filter(Objects::nonNull).distinct().toList();

		Map<Long, School> schoolMap = (schoolRepository != null && !schoolIds.isEmpty())
				? schoolRepository.findAllById(schoolIds).stream()
						.collect(Collectors.toMap(School::getId, s -> s, (s1, s2) -> s1))
				: Collections.emptyMap();

		Map<Long, List<TeacherStandardDivision>> tsdMap = (teacherStandardDivisionRepository != null
				&& !teacherIds.isEmpty())
						? teacherStandardDivisionRepository.findByTeacherIdIn(teacherIds).stream()
								.filter(tsd -> tsd.getTeacher() != null && tsd.getTeacher().getId() != null)
								.collect(Collectors.groupingBy(tsd -> tsd.getTeacher().getId()))
						: Collections.emptyMap();

		Map<Long, List<ClassRoom>> classRoomMap = (classRoomRepository != null && !teacherIds.isEmpty())
				? classRoomRepository.findByTeacherIdIn(teacherIds).stream()
						.filter(cr -> cr.getTeacherId() != null)
						.collect(Collectors.groupingBy(ClassRoom::getTeacherId))
				: Collections.emptyMap();

		return teachers.stream().map(teacher -> {
			School school = teacher.getSchoolId() != null ? schoolMap.get(teacher.getSchoolId()) : null;

			String dept = null;
			String exp = null;
			String qual = null;
			if (teacher instanceof Teacher t) {
				dept = t.getDepartment();
				exp = t.getExperience();
				qual = t.getQualification();
			}

			List<TeacherStandardDivision> mappings = tsdMap.get(teacher.getId());
			List<ClassRoom> rooms = classRoomMap.get(teacher.getId());
			List<StandardDivisionPair> pairs = assembleAssignedPairs(teacher.getId(), teacher, mappings, rooms);

			return SchoolTeacherResponse.builder()
					.id(teacher.getId())
					.firstName(teacher.getFirstName())
					.lastName(teacher.getLastName())
					.email(teacher.getEmail())
					.phone(teacher.getPhone())
					.schoolId(teacher.getSchoolId())
					.schoolName(school != null ? school.getName() : null)
					.active(teacher.isActive())
					.role(teacher.getRole() != null ? teacher.getRole().name() : "TEACHER")
					.department(dept)
					.experience(exp)
					.qualification(qual)
					.standardDivisions(pairs)
					.emailSent(null)
					.build();
		}).collect(Collectors.toList());
	}

	private SchoolTeacherResponse mapToResponse(User teacher, Boolean emailSent) {
		if (teacher == null) {
			return null;
		}
		School school = (teacher.getSchoolId() != null && schoolRepository != null)
				? schoolRepository.findById(teacher.getSchoolId()).orElse(null)
				: null;

		String dept = null;
		String exp = null;
		String qual = null;
		if (teacher instanceof Teacher t) {
			dept = t.getDepartment();
			exp = t.getExperience();
			qual = t.getQualification();
		}

		List<StandardDivisionPair> pairs = getTeacherAssignedPairs(teacher.getId(), teacher);

		return SchoolTeacherResponse.builder()
				.id(teacher.getId())
				.firstName(teacher.getFirstName())
				.lastName(teacher.getLastName())
				.email(teacher.getEmail())
				.phone(teacher.getPhone())
				.schoolId(teacher.getSchoolId())
				.schoolName(school != null ? school.getName() : null)
				.active(teacher.isActive())
				.role(teacher.getRole() != null ? teacher.getRole().name() : "TEACHER")
				.department(dept)
				.experience(exp)
				.qualification(qual)
				.standardDivisions(pairs)
				.emailSent(emailSent)
				.build();
	}

	private List<StandardDivisionPair> resolvePairs(SchoolTeacherRequest request) {
		if (request.getStandardDivisions() != null && !request.getStandardDivisions().isEmpty()) {
			return request.getStandardDivisions();
		}
		if (request.getStandard() != null && request.getDivision() != null) {
			return Collections.singletonList(
					StandardDivisionPair.builder()
							.standard(request.getStandard())
							.division(request.getDivision())
							.build());
		}
		return Collections.emptyList();
	}

	private void validateStandardsAndDivisions(Long schoolId, List<StandardDivisionPair> pairs) {
		validateStandardsAndDivisions(schoolId, pairs, null);
	}

	private void validateStandardsAndDivisions(Long schoolId, List<StandardDivisionPair> pairs, Long excludeTeacherId) {
		if (schoolStandardRepository == null || standardDivisionRepository == null || pairs == null
				|| pairs.isEmpty()) {
			return;
		}

		// Prevent duplicate assignment pairs within the same request
		java.util.Set<String> seenInRequest = new java.util.HashSet<>();
		for (StandardDivisionPair pair : pairs) {
			if (pair == null || pair.getStandard() == null)
				continue;
			String key = normalizeStandard(pair.getStandard()) + "-"
					+ (pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : "");
			if (!seenInRequest.add(key)) {
				throw new DuplicateAssignmentException("Duplicate assignment in request: Standard " + pair.getStandard()
						+ (pair.getDivision() != null ? " - Division " + pair.getDivision() : ""));
			}
		}

		List<String> conflictMessages = new ArrayList<>();

		for (StandardDivisionPair pair : pairs) {
			if (pair == null || pair.getStandard() == null || pair.getStandard().isBlank()) {
				continue;
			}

			String rawStd = pair.getStandard().trim();
			SchoolStandard ss = schoolStandardRepository.findBySchoolIdAndStandard(schoolId, rawStd).orElse(null);
			if (ss == null) {
				List<SchoolStandard> standards = schoolStandardRepository.findBySchoolId(schoolId);
				if (standards != null) {
					for (SchoolStandard sCandidate : standards) {
						if (normalizeStandard(sCandidate.getStandard()).equalsIgnoreCase(normalizeStandard(rawStd))) {
							ss = sCandidate;
							break;
						}
					}
				}
			}
			if (ss == null) {
				throw new IllegalArgumentException("Invalid standard: " + rawStd);
			}

			if (pair.getDivision() != null && !pair.getDivision().isBlank()) {
				String rawDiv = pair.getDivision().trim();
				StandardDivision sd = standardDivisionRepository.findBySchoolStandardIdAndDivision(ss.getId(), rawDiv)
						.orElse(null);
				if (sd == null) {
					List<StandardDivision> divisions = standardDivisionRepository.findBySchoolStandardId(ss.getId());
					if (divisions != null) {
						for (StandardDivision dCandidate : divisions) {
							if (dCandidate.getDivision() != null
									&& dCandidate.getDivision().trim().equalsIgnoreCase(rawDiv)) {
								sd = dCandidate;
								break;
							}
						}
					}
				}
				if (sd == null) {
					throw new IllegalArgumentException("Invalid division: " + rawDiv);
				}

				if (teacherStandardDivisionRepository != null) {
					java.util.Optional<TeacherStandardDivision> existingTsd = (excludeTeacherId != null)
							? teacherStandardDivisionRepository.findFirstByStandardDivisionIdAndTeacherIdNot(sd.getId(),
									excludeTeacherId)
							: teacherStandardDivisionRepository.findFirstByStandardDivisionId(sd.getId());

					if (existingTsd.isPresent()) {
						User conflictTeacher = existingTsd.get().getTeacher();
						String teacherName = "another teacher";
						if (conflictTeacher != null) {
							String name = ((conflictTeacher.getFirstName() != null ? conflictTeacher.getFirstName()
									: "") + " "
									+ (conflictTeacher.getLastName() != null ? conflictTeacher.getLastName() : ""))
									.trim();
							if (!name.isEmpty()) {
								teacherName = name;
							} else if (conflictTeacher.getEmail() != null) {
								teacherName = conflictTeacher.getEmail();
							}
						}
						conflictMessages.add("Standard " + pair.getStandard() + " - Division " + pair.getDivision()
								+ " is already assigned to " + teacherName);
					}
				}
			}
		}

		if (!conflictMessages.isEmpty()) {
			throw new DuplicateAssignmentException(String.join(". ", conflictMessages) + ".");
		}
	}

	private void syncClassRooms(Teacher teacher, List<StandardDivisionPair> pairs) {
		if (classRoomRepository == null || teacher == null || teacher.getId() == null) {
			return;
		}

		List<ClassRoom> existingRooms = classRoomRepository.findByTeacherId(teacher.getId());
		if (existingRooms == null) {
			existingRooms = new ArrayList<>();
		}

		java.util.Set<String> targetKeys = new java.util.HashSet<>();
		if (pairs != null) {
			for (StandardDivisionPair pair : pairs) {
				if (pair != null && pair.getStandard() != null) {
					String normStd = normalizeStandard(pair.getStandard());
					String normDiv = pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : "";
					targetKeys.add(normStd + "-" + normDiv);
				}
			}
		}

		// 1. Upgrade any legacy rooms with null division matching a target standard
		if (pairs != null) {
			for (StandardDivisionPair pair : pairs) {
				if (pair == null || pair.getStandard() == null) continue;
				String normStd = normalizeStandard(pair.getStandard());
				Optional<ClassRoom> legacyRoom = existingRooms.stream()
						.filter(r -> r.getDivision() == null && normalizeStandard(r.getGrade()).equalsIgnoreCase(normStd))
						.findFirst();
				if (legacyRoom.isPresent()) {
					ClassRoom room = legacyRoom.get();
					room.setDivision(pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : null);
					classRoomRepository.save(room);
				}
			}
		}

		// 2. Unassign rooms that are no longer assigned to this teacher, or are duplicate classrooms for the same pair
		java.util.Set<String> keptKeys = new java.util.HashSet<>();
		for (ClassRoom room : existingRooms) {
			String roomStd = normalizeStandard(room.getGrade());
			String roomDiv = room.getDivision() != null ? room.getDivision().trim().toUpperCase() : "";
			String roomKey = roomStd + "-" + roomDiv;
			if (!targetKeys.contains(roomKey) || keptKeys.contains(roomKey)) {
				room.setTeacherId(null);
				classRoomRepository.save(room);
			} else {
				keptKeys.add(roomKey);
				if (!roomStd.equals(room.getGrade())) {
					room.setGrade(roomStd);
					room.setName("Grade " + roomStd + (!roomDiv.isEmpty() ? " - " + roomDiv : ""));
					classRoomRepository.save(room);
				}
			}
		}

		// 3. Assign / create rooms for target pairs
		if (pairs != null) {
			for (StandardDivisionPair pair : pairs) {
				if (pair == null || pair.getStandard() == null) continue;
				String normStd = normalizeStandard(pair.getStandard());
				String normDiv = pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : null;

				boolean alreadyAssigned = existingRooms.stream()
						.anyMatch(r -> normalizeStandard(r.getGrade()).equalsIgnoreCase(normStd)
								&& ((normDiv == null && r.getDivision() == null)
										|| (normDiv != null && normDiv.equalsIgnoreCase(r.getDivision()))));

				if (!alreadyAssigned) {
					List<ClassRoom> schoolRooms = classRoomRepository.findBySchoolId(teacher.getSchoolId());
					ClassRoom matchingRoom = (schoolRooms != null) ? schoolRooms.stream()
							.filter(r -> normalizeStandard(r.getGrade()).equalsIgnoreCase(normStd)
									&& ((normDiv == null && r.getDivision() == null)
											|| (normDiv != null && normDiv.equalsIgnoreCase(r.getDivision()))))
							.findFirst().orElse(null) : null;

					if (matchingRoom != null) {
						matchingRoom.setTeacherId(teacher.getId());
						matchingRoom.setGrade(normStd);
						matchingRoom.setDivision(normDiv);
						classRoomRepository.save(matchingRoom);
					} else {
						ClassRoom newRoom = ClassRoom.builder()
								.grade(normStd)
								.division(normDiv)
								.schoolId(teacher.getSchoolId())
								.teacherId(teacher.getId())
								.academicYear("2026-2027")
								.status(Status.ACTIVE)
								.name("Grade " + normStd + (normDiv != null ? " - " + normDiv : ""))
								.build();
						classRoomRepository.save(newRoom);
					}
				}
			}
		}
	}

	private void syncTeacherStandardDivisions(Teacher teacher, List<StandardDivisionPair> pairs) {
		if (teacherStandardDivisionRepository == null || schoolStandardRepository == null
				|| standardDivisionRepository == null || pairs == null || teacher == null || teacher.getId() == null) {
			return;
		}
		// 1. Resolve all target StandardDivision entities from the pairs
		Map<Long, StandardDivision> targetSdMap = new LinkedHashMap<>();
		List<SchoolStandard> schoolStandards = schoolStandardRepository.findBySchoolId(teacher.getSchoolId());

		for (StandardDivisionPair pair : pairs) {
			if (pair == null || pair.getStandard() == null) {
				continue;
			}
			String rawStd = pair.getStandard().trim();
			String rawDiv = pair.getDivision() != null ? pair.getDivision().trim() : null;

			SchoolStandard ss = schoolStandardRepository.findBySchoolIdAndStandard(teacher.getSchoolId(), rawStd)
					.orElse(null);
			if (ss == null && schoolStandards != null) {
				for (SchoolStandard sCandidate : schoolStandards) {
					if (normalizeStandard(sCandidate.getStandard()).equalsIgnoreCase(normalizeStandard(rawStd))) {
						ss = sCandidate;
						break;
					}
				}
			}

			if (ss != null && rawDiv != null) {
				StandardDivision sd = standardDivisionRepository
						.findBySchoolStandardIdAndDivision(ss.getId(), rawDiv).orElse(null);
				if (sd == null) {
					List<StandardDivision> divisions = standardDivisionRepository.findBySchoolStandardId(ss.getId());
					if (divisions != null) {
						for (StandardDivision dCandidate : divisions) {
							if (dCandidate.getDivision() != null
									&& dCandidate.getDivision().trim().equalsIgnoreCase(rawDiv)) {
								sd = dCandidate;
								break;
							}
						}
					}
				}
				if (sd != null && sd.getId() != null) {
					targetSdMap.put(sd.getId(), sd);
				}
			}
		}

		// 2. Fetch existing assignments for this teacher
		List<TeacherStandardDivision> existingTsds = teacherStandardDivisionRepository.findByTeacherId(teacher.getId());
		List<TeacherStandardDivision> toDelete = new ArrayList<>();
		java.util.Set<Long> existingSdIds = new java.util.HashSet<>();

		if (existingTsds != null) {
			for (TeacherStandardDivision existing : existingTsds) {
				if (existing.getStandardDivision() != null && existing.getStandardDivision().getId() != null) {
					Long sdId = existing.getStandardDivision().getId();
					if (targetSdMap.containsKey(sdId)) {
						existingSdIds.add(sdId);
					} else {
						toDelete.add(existing);
					}
				} else {
					toDelete.add(existing);
				}
			}
		}

		// 3. Delete unselected assignments and flush immediately so DB unique constraint is clean
		if (!toDelete.isEmpty()) {
			teacherStandardDivisionRepository.deleteAll(toDelete);
			teacherStandardDivisionRepository.flush();
		}

		// 4. Save ONLY the new assignments that aren't already existing
		for (Map.Entry<Long, StandardDivision> entry : targetSdMap.entrySet()) {
			if (!existingSdIds.contains(entry.getKey())) {
				TeacherStandardDivision tsd = TeacherStandardDivision.builder()
						.teacher(teacher)
						.standardDivision(entry.getValue())
						.build();
				teacherStandardDivisionRepository.save(tsd);
			}
		}
	}

	@Override
	public SchoolTeacherResponse createTeacher(SchoolTeacherRequest request) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can create teachers");
		}

		Long targetSchoolId = (role == Role.SUPER_ADMIN || role == Role.ADMIN)
				? (request.getSchoolId() != null ? request.getSchoolId() : currentUser.getSchoolId())
				: currentUser.getSchoolId();

		if (targetSchoolId == null) {
			throw new RuntimeException("Teacher must be associated with a school");
		}

		if (userRepository.existsByEmail(request.getEmail())) {
			throw new DuplicateEmailException("An account with email '" + request.getEmail()
					+ "' already exists. Please use a different email address.");
		}

		List<StandardDivisionPair> pairs = resolvePairs(request);

		Teacher teacher = Teacher.builder()
				.firstName(request.getFirstName())
				.lastName(request.getLastName())
				.email(request.getEmail())
				.password(passwordEncoder
						.encode(request.getPassword() != null ? request.getPassword() : "defaultPassword123!"))
				.role(Role.TEACHER)
				.schoolId(targetSchoolId)
				.phone(com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getPhone(),
						"Teacher phone"))
				.active(request.isActive())
				.userType(UserType.SCHOOL)
				.status(Status.ACTIVE)
				.department(request.getDepartment())
				.experience(request.getExperience())
				.qualification(request.getQualification())
				.build();

		Teacher savedTeacher = (teacherRepository != null)
				? teacherRepository.save(teacher)
				: (Teacher) userRepository.save(teacher);

		if (savedTeacher == null) {
			savedTeacher = teacher;
		}

		validateStandardsAndDivisions(targetSchoolId, pairs);
		syncClassRooms(savedTeacher, pairs);
		syncTeacherStandardDivisions(savedTeacher, pairs);

		if (settingsRepository != null) {
			Settings settings = Settings.builder().user(savedTeacher).build();
			settingsRepository.save(settings);
		}

		// Dispatch notifications
		if (notificationService != null) {
			try {
				String teacherName = (savedTeacher.getFirstName() + " "
						+ (savedTeacher.getLastName() != null ? savedTeacher.getLastName() : "")).trim();
				School school = (schoolRepository != null && targetSchoolId != null)
						? schoolRepository.findById(targetSchoolId).orElse(null)
						: null;
				String schoolName = school != null ? school.getName() : "School";
				notificationService.notifyAdmins("New Teacher Added",
						"Teacher " + teacherName + " has been added to " + schoolName + ".",
						NotificationType.TEACHER_CREATED, savedTeacher.getId(), "TEACHER");
				if (targetSchoolId != null) {
					notificationService.notifySchoolAdmins(targetSchoolId, "New Teacher Added",
							"Teacher " + teacherName + " has been added to " + schoolName + ".",
							NotificationType.TEACHER_CREATED, savedTeacher.getId(), "TEACHER");
				}
				notificationService.sendNotification(savedTeacher.getEmail(), "Welcome to SpeakMate AI",
						"Your teacher account for " + schoolName + " has been created.",
						NotificationType.TEACHER_CREATED, savedTeacher.getId(), "TEACHER");
			} catch (Exception ignored) {
			}
		}

		// Generate and send credentials email to the teacher
		Boolean emailSent = false;
		if (emailService != null) {
			try {
				String rawPassword = (request.getPassword() != null && !request.getPassword().isBlank())
						? request.getPassword()
						: "defaultPassword123!";
				String teacherName = ((savedTeacher.getFirstName() != null ? savedTeacher.getFirstName() : "") + " "
						+ (savedTeacher.getLastName() != null ? savedTeacher.getLastName() : "")).trim();
				School school = (schoolRepository != null && targetSchoolId != null)
						? schoolRepository.findById(targetSchoolId).orElse(null)
						: null;
				String schoolName = school != null ? school.getName() : "Your School";
				String schoolCode = (school != null && school.getSchoolCode() != null
						&& !school.getSchoolCode().isBlank())
								? school.getSchoolCode()
								: "N/A";
				String assignedClasses = (pairs != null && !pairs.isEmpty())
						? pairs.stream().map(p -> "Std " + p.getStandard() + " (" + p.getDivision() + ")")
								.collect(java.util.stream.Collectors.joining(", "))
						: "General";

				String subject = "Welcome to SpeakMate AI - Your Teacher Account Credentials";

				if (emailTemplateService != null) {
					String html = emailTemplateService.buildTeacherWelcomeEmailHtml(
							teacherName,
							savedTeacher.getEmail(),
							rawPassword,
							schoolName,
							schoolCode,
							savedTeacher.getDepartment(),
							assignedClasses);
					String text = emailTemplateService.buildTeacherWelcomeEmailText(
							teacherName,
							savedTeacher.getEmail(),
							rawPassword,
							schoolName,
							schoolCode,
							savedTeacher.getDepartment(),
							assignedClasses);
					emailService.sendHtmlEmail(savedTeacher.getEmail(), subject, html, text);
				} else {
					String loginUrl = (frontendUrl != null ? frontendUrl : "https://speak-mate-ai-nine.vercel.app") + "/teacher/login";
					String text = "Hello " + (teacherName.isEmpty() ? "Teacher" : teacherName) + ",\n\n"
							+ "You have been registered as a Teacher for " + schoolName + " on SpeakMate AI.\n\n"
							+ "School Code: " + schoolCode + "\n"
							+ "Assigned Classes: " + assignedClasses + "\n\n"
							+ "Here are your login credentials:\n"
							+ "--------------------------------------------------\n"
							+ "Portal URL: " + loginUrl + "\n"
							+ "Email:      " + savedTeacher.getEmail() + "\n"
							+ "Password:   " + rawPassword + "\n"
							+ "--------------------------------------------------\n\n"
							+ "Best regards,\nSpeakMate AI Team";
					emailService.sendEmail(savedTeacher.getEmail(), subject, text);
				}
				emailSent = true;
				System.out.println("Teacher credentials email sent successfully to " + savedTeacher.getEmail());
			} catch (Exception e) {
				System.err.println("Failed to send teacher credentials email to " + savedTeacher.getEmail() + ": "
						+ e.getMessage());
				emailSent = false;
			}
		}

		return mapToResponse(savedTeacher, emailSent);
	}

	@Override
	public List<SchoolTeacherResponse> getAllTeachers() {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can view teachers");
		}

		List<User> teachers;
		if (role == Role.SUPER_ADMIN || role == Role.ADMIN) {
			teachers = userRepository.findByRole(Role.TEACHER);
		} else {
			if (currentUser.getSchoolId() == null) {
				throw new RuntimeException("School Admin is not associated with any school");
			}
			teachers = userRepository.findBySchoolIdAndRole(currentUser.getSchoolId(), Role.TEACHER);
		}

		return mapTeachersToResponses(teachers);
	}

	@Override
	public List<SchoolTeacherResponse> searchTeachers(String query) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can search teachers");
		}

		String lowerQuery = query != null ? query.toLowerCase() : "";
		List<User> baseTeachers = (role == Role.SUPER_ADMIN || role == Role.ADMIN)
				? userRepository.findByRole(Role.TEACHER)
				: (currentUser.getSchoolId() != null
						? userRepository.findBySchoolIdAndRole(currentUser.getSchoolId(), Role.TEACHER)
						: List.of());

		List<User> matchedTeachers = baseTeachers.stream()
				.filter(t -> (t.getFirstName() != null && t.getFirstName().toLowerCase().contains(lowerQuery))
						|| (t.getLastName() != null && t.getLastName().toLowerCase().contains(lowerQuery))
						|| (t.getEmail() != null && t.getEmail().toLowerCase().contains(lowerQuery)))
				.collect(Collectors.toList());

		return mapTeachersToResponses(matchedTeachers);
	}

	@Override
	public SchoolTeacherResponse getTeacherById(Long id) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can view teachers");
		}

		Teacher teacher = null;
		if (teacherRepository != null) {
			teacher = teacherRepository.findById(id).orElse(null);
		}
		if (teacher == null) {
			User u = userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("Teacher not found"));
			if (u instanceof Teacher t) {
				teacher = t;
			} else {
				throw new UserNotFoundException("Teacher not found");
			}
		}

		if (teacher.getRole() != Role.TEACHER) {
			throw new RuntimeException("User is not a teacher");
		}

		if (role == Role.SCHOOL_ADMIN && !teacher.getSchoolId().equals(currentUser.getSchoolId())) {
			throw new RuntimeException("Unauthorized: Teacher does not belong to your school");
		}

		return mapToResponse(teacher);
	}

	@Override
	public SchoolTeacherResponse updateTeacher(Long id, SchoolTeacherRequest request) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can update teachers");
		}

		Teacher teacher = null;
		if (teacherRepository != null) {
			teacher = teacherRepository.findById(id).orElse(null);
		}
		if (teacher == null) {
			User u = userRepository.findById(id).orElse(null);
			if (u instanceof Teacher t) {
				teacher = t;
			}
		}

		if (teacher == null) {
			throw new UserNotFoundException("Teacher not found");
		}

		if (teacher.getRole() != Role.TEACHER) {
			throw new RuntimeException("User is not a teacher");
		}

		if (role == Role.SCHOOL_ADMIN && !teacher.getSchoolId().equals(currentUser.getSchoolId())) {
			throw new RuntimeException("Unauthorized: Teacher does not belong to your school");
		}

		List<StandardDivisionPair> pairs = resolvePairs(request);
		if (request.getStandardDivisions() != null || request.getStandard() != null || request.getDivision() != null) {
			if (!pairs.isEmpty()) {
				validateStandardsAndDivisions(teacher.getSchoolId(), pairs, teacher.getId());
			}
			syncClassRooms(teacher, pairs);
			syncTeacherStandardDivisions(teacher, pairs);
			if (!pairs.isEmpty()) {
				teacher.setStandard(pairs.get(0).getStandard());
				teacher.setDivision(pairs.get(0).getDivision());
			} else {
				teacher.setStandard(null);
				teacher.setDivision(null);
			}
		}

		if (request.getFirstName() != null)
			teacher.setFirstName(request.getFirstName());
		if (request.getLastName() != null)
			teacher.setLastName(request.getLastName());
		if (request.getPhone() != null)
			teacher.setPhone(com.rslsolution.speakmateai.util.PhoneNumberUtil.validateAndNormalize(request.getPhone(),
					"Teacher phone"));
		teacher.setActive(request.isActive());
		teacher.setStatus(request.isActive() ? com.rslsolution.speakmateai.enums.Status.ACTIVE : com.rslsolution.speakmateai.enums.Status.INACTIVE);

		if (request.getDepartment() != null)
			teacher.setDepartment(request.getDepartment());
		if (request.getExperience() != null)
			teacher.setExperience(request.getExperience());
		if (request.getQualification() != null)
			teacher.setQualification(request.getQualification());

		if (request.getSchoolId() != null && (role == Role.SUPER_ADMIN || role == Role.ADMIN)) {
			teacher.setSchoolId(request.getSchoolId());
		}

		if (request.getPassword() != null && !request.getPassword().isBlank()) {
			teacher.setPassword(passwordEncoder.encode(request.getPassword()));
		}

		Teacher updatedTeacher = (teacherRepository != null)
				? teacherRepository.save(teacher)
				: (Teacher) userRepository.save(teacher);

		String teacherName = ((updatedTeacher.getFirstName() != null ? updatedTeacher.getFirstName() : "") + " " +
				(updatedTeacher.getLastName() != null ? updatedTeacher.getLastName() : "")).trim();

		// Dispatch notifications for update
		if (notificationService != null) {
			try {
				notificationService.notifyAdmins(
						"Teacher Updated",
						"Teacher " + teacherName + " details have been updated.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
				if (updatedTeacher.getSchoolId() != null) {
					notificationService.notifySchoolAdmins(
							updatedTeacher.getSchoolId(),
							"Teacher Updated",
							"Teacher " + teacherName + " details have been updated.",
							com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
							updatedTeacher.getId(),
							"TEACHER");
				}
				notificationService.sendNotification(
						updatedTeacher.getEmail(),
						"Account Details Updated",
						"Your teacher account details and assignments have been updated.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
			} catch (Exception ignored) {}
		}

		return mapToResponse(updatedTeacher != null ? updatedTeacher : teacher);
	}

	@Override
	public void deactivateTeacher(Long id) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can deactivate teachers");
		}

		Teacher teacher = null;
		if (teacherRepository != null) {
			teacher = teacherRepository.findById(id).orElse(null);
		}
		if (teacher == null) {
			User u = userRepository.findById(id).orElse(null);
			if (u instanceof Teacher t) {
				teacher = t;
			}
		}

		if (teacher == null) {
			throw new UserNotFoundException("Teacher not found");
		}

		if (teacher.getRole() != Role.TEACHER) {
			throw new RuntimeException("User is not a teacher");
		}

		if (role == Role.SCHOOL_ADMIN && !teacher.getSchoolId().equals(currentUser.getSchoolId())) {
			throw new RuntimeException("Unauthorized: Teacher does not belong to your school");
		}

		if (entityCascadeDeletionService != null) {
			entityCascadeDeletionService.deleteTeacherCascade(id);
		} else {
			if (teacherRepository != null) {
				teacherRepository.delete(teacher);
			}
			userRepository.delete(teacher);
		}
	}

	@Override
	public SchoolTeacherResponse activateTeacher(Long id) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can activate teachers");
		}

		Teacher teacher = null;
		if (teacherRepository != null) {
			teacher = teacherRepository.findById(id).orElse(null);
		}
		if (teacher == null) {
			User u = userRepository.findById(id).orElse(null);
			if (u instanceof Teacher t) {
				teacher = t;
			}
		}

		if (teacher == null) {
			throw new UserNotFoundException("Teacher not found");
		}

		if (teacher.getRole() != Role.TEACHER) {
			throw new RuntimeException("User is not a teacher");
		}

		if (role == Role.SCHOOL_ADMIN && !teacher.getSchoolId().equals(currentUser.getSchoolId())) {
			throw new RuntimeException("Unauthorized: Teacher does not belong to your school");
		}

		teacher.setActive(true);
		teacher.setStatus(com.rslsolution.speakmateai.enums.Status.ACTIVE);
		Teacher updatedTeacher = (teacherRepository != null)
				? teacherRepository.save(teacher)
				: (Teacher) userRepository.save(teacher);

		String teacherName = ((updatedTeacher.getFirstName() != null ? updatedTeacher.getFirstName() : "") + " " +
				(updatedTeacher.getLastName() != null ? updatedTeacher.getLastName() : "")).trim();

		// Dispatch notifications
		if (notificationService != null) {
			try {
				notificationService.notifyAdmins(
						"Teacher Activated",
						"Teacher " + teacherName + " has been activated by Super Admin.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
			} catch (Exception e) {
				System.err.println("Failed to dispatch admin notification on activate teacher: " + e.getMessage());
			}

			if (updatedTeacher.getSchoolId() != null) {
				try {
					notificationService.notifySchoolAdmins(
							updatedTeacher.getSchoolId(),
							"Teacher Activated",
							"Teacher " + teacherName + " has been activated by Super Admin.",
							com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
							updatedTeacher.getId(),
							"TEACHER");
				} catch (Exception e) {
					System.err.println(
							"Failed to dispatch school admin notification on activate teacher: " + e.getMessage());
				}
			}

			try {
				notificationService.sendNotification(
						updatedTeacher.getEmail(),
						"Teacher Account Activated",
						"Your SpeakMate AI teacher account has been activated. You now have full access to your portal.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
			} catch (Exception e) {
				System.err.println("Failed to dispatch teacher notification on activate: " + e.getMessage());
			}
		}

		return mapToResponse(updatedTeacher != null ? updatedTeacher : teacher);
	}

	@Override
	public SchoolTeacherResponse deactivateTeacherStatus(Long id) {
		User currentUser = getCurrentUser();
		Role role = currentUser.getRole();

		if (role != Role.SCHOOL_ADMIN && role != Role.SUPER_ADMIN && role != Role.ADMIN) {
			throw new RuntimeException("Unauthorized: Only School Admin or Platform Admin can deactivate teachers");
		}

		Teacher teacher = null;
		if (teacherRepository != null) {
			teacher = teacherRepository.findById(id).orElse(null);
		}
		if (teacher == null) {
			User u = userRepository.findById(id).orElse(null);
			if (u instanceof Teacher t) {
				teacher = t;
			}
		}

		if (teacher == null) {
			throw new UserNotFoundException("Teacher not found");
		}

		if (teacher.getRole() != Role.TEACHER) {
			throw new RuntimeException("User is not a teacher");
		}

		if (role == Role.SCHOOL_ADMIN && !teacher.getSchoolId().equals(currentUser.getSchoolId())) {
			throw new RuntimeException("Unauthorized: Teacher does not belong to your school");
		}

		teacher.setActive(false);
		teacher.setStatus(com.rslsolution.speakmateai.enums.Status.INACTIVE);
		Teacher updatedTeacher = (teacherRepository != null)
				? teacherRepository.save(teacher)
				: (Teacher) userRepository.save(teacher);

		String teacherName = ((updatedTeacher.getFirstName() != null ? updatedTeacher.getFirstName() : "") + " " +
				(updatedTeacher.getLastName() != null ? updatedTeacher.getLastName() : "")).trim();

		// Dispatch notifications
		if (notificationService != null) {
			try {
				notificationService.notifyAdmins(
						"Teacher Deactivated",
						"Teacher " + teacherName + " has been deactivated by Super Admin.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
			} catch (Exception e) {
				System.err.println("Failed to dispatch admin notification on deactivate teacher: " + e.getMessage());
			}

			if (updatedTeacher.getSchoolId() != null) {
				try {
					notificationService.notifySchoolAdmins(
							updatedTeacher.getSchoolId(),
							"Teacher Deactivated",
							"Teacher " + teacherName + " has been deactivated by Super Admin.",
							com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
							updatedTeacher.getId(),
							"TEACHER");
				} catch (Exception e) {
					System.err.println(
							"Failed to dispatch school admin notification on deactivate teacher: " + e.getMessage());
				}
			}

			try {
				notificationService.sendNotification(
						updatedTeacher.getEmail(),
						"Teacher Account Deactivated",
						"Your SpeakMate AI teacher account has been deactivated by administration. Access is restricted.",
						com.rslsolution.speakmateai.enums.NotificationType.TEACHER_UPDATED,
						updatedTeacher.getId(),
						"TEACHER");
			} catch (Exception e) {
				System.err.println("Failed to dispatch teacher notification on deactivate: " + e.getMessage());
			}
		}

		return mapToResponse(updatedTeacher != null ? updatedTeacher : teacher);
	}

	@Override
	public SchoolTeacherResponse getAssignedTeacher(Long schoolId, String standard, String division) {
		if (schoolId == null || standard == null || standard.isBlank()) {
			return null;
		}

		String normTargetStd = normalizeStandard(standard);
		String normTargetDiv = division != null ? division.trim().toUpperCase() : "";

		List<User> schoolTeachers = userRepository.findBySchoolIdAndRole(schoolId, Role.TEACHER);
		if (schoolTeachers == null || schoolTeachers.isEmpty()) {
			return null;
		}

		List<SchoolTeacherResponse> responses = mapTeachersToResponses(schoolTeachers);

		// First pass: Active teachers matching both standard and division
		for (SchoolTeacherResponse resp : responses) {
			if (!Boolean.TRUE.equals(resp.getActive())) {
				continue;
			}
			if (resp.getStandardDivisions() != null) {
				for (StandardDivisionPair pair : resp.getStandardDivisions()) {
					if (pair == null || pair.getStandard() == null)
						continue;
					String std = normalizeStandard(pair.getStandard());
					String div = pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : "";

					boolean stdMatch = std.equals(normTargetStd);
					boolean divMatch = normTargetDiv.isEmpty() || div.isEmpty() || div.equals(normTargetDiv);

					if (stdMatch && divMatch) {
						return resp;
					}
				}
			}
		}

		// Second pass: Any teacher matching standard and division
		for (SchoolTeacherResponse resp : responses) {
			if (resp.getStandardDivisions() != null) {
				for (StandardDivisionPair pair : resp.getStandardDivisions()) {
					if (pair == null || pair.getStandard() == null)
						continue;
					String std = normalizeStandard(pair.getStandard());
					String div = pair.getDivision() != null ? pair.getDivision().trim().toUpperCase() : "";

					boolean stdMatch = std.equals(normTargetStd);
					boolean divMatch = normTargetDiv.isEmpty() || div.isEmpty() || div.equals(normTargetDiv);

					if (stdMatch && divMatch) {
						return resp;
					}
				}
			}
		}

		return null;
	}
}
