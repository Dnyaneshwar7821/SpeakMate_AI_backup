package com.rslsolution.speakmateai.assistant.provider;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rslsolution.speakmateai.assistant.ActorContext;
import com.rslsolution.speakmateai.assistant.TeacherAssignmentResolver;
import com.rslsolution.speakmateai.dto.assistant.AssistantIntent;
import com.rslsolution.speakmateai.entity.Progress;
import com.rslsolution.speakmateai.entity.School;
import com.rslsolution.speakmateai.entity.SchoolStandard;
import com.rslsolution.speakmateai.entity.Student;
import com.rslsolution.speakmateai.entity.Teacher;
import com.rslsolution.speakmateai.entity.TeacherStandardDivision;
import com.rslsolution.speakmateai.entity.User;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.ProgressRepository;
import com.rslsolution.speakmateai.repository.SchoolRepository;
import com.rslsolution.speakmateai.repository.StudentRepository;
import com.rslsolution.speakmateai.repository.TeacherRepository;
import com.rslsolution.speakmateai.repository.TeacherStandardDivisionRepository;
import com.rslsolution.speakmateai.repository.UserRepository;

/**
 * School roster provider: returns the actual DETAILS of teachers and/or students
 * (names, email, phone, department/subject, designation, experience,
 * qualification, employee id, join date and assigned classes for teachers;
 * standard, division, student id and assigned teacher for students) so questions
 * like "name of the teacher", "which department is Digvijay Patil in", "which
 * subject does he teach" or "when did he join the school" get a real answer
 * instead of "not available".
 *
 * <p>Scoping (registry-enforced role matrix):
 * <ul>
 *   <li>Super Admin - any school, resolved from the school name in the question;</li>
 *   <li>School Admin - always their own school;</li>
 *   <li>Teacher - only their own assigned students (no other school data).</li>
 * </ul>
 */
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class SchoolRosterDataProvider implements AssistantDataProvider {

	private static final DateTimeFormatter JOINED_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");

	private final SchoolRepository schoolRepository;
	private final UserRepository userRepository;
	private final StudentRepository studentRepository;
	private final TeacherRepository teacherRepository;
	private final TeacherStandardDivisionRepository teacherStandardDivisionRepository;
	private final TeacherAssignmentResolver teacherAssignmentResolver;
	private final ProgressRepository progressRepository;
	private final ObjectMapper objectMapper;

	public SchoolRosterDataProvider(SchoolRepository schoolRepository, UserRepository userRepository,
			StudentRepository studentRepository, TeacherRepository teacherRepository,
			TeacherStandardDivisionRepository teacherStandardDivisionRepository,
			TeacherAssignmentResolver teacherAssignmentResolver,
			ProgressRepository progressRepository,
			ObjectMapper objectMapper) {
		this.schoolRepository = schoolRepository;
		this.userRepository = userRepository;
		this.studentRepository = studentRepository;
		this.teacherRepository = teacherRepository;
		this.teacherStandardDivisionRepository = teacherStandardDivisionRepository;
		this.teacherAssignmentResolver = teacherAssignmentResolver;
		this.progressRepository = progressRepository;
		this.objectMapper = objectMapper;
	}

	@Override
	public AssistantIntent intent() {
		return AssistantIntent.SCHOOL_ROSTER;
	}

	@Override
	public String provide(ActorContext actor, Map<String, Object> params) {
		// ─────────────────────────────────────────────────────────────────────
		// CROSS-SCHOOL ACCESS GUARD — runs first, before ANY data retrieval.
		//
		// For TEACHER and SCHOOL_ADMIN: if the request names a school that is
		// different from the authenticated user's authorized school, stop here
		// and return ACCESS DENIED.  The school name from user input is used
		// ONLY to detect a cross-school violation; it never expands scope.
		//
		// This guard intentionally precedes the TEACHER early-return block so
		// that a teacher asking "students of PCMC" cannot receive their own
		// school's students mislabelled as PCMC students.
		// ─────────────────────────────────────────────────────────────────────
		if (actor.getRole() == Role.TEACHER || actor.getRole() == Role.SCHOOL_ADMIN) {
			String requestedName = strParam(params, "schoolName").trim();
			if (requestedName.isEmpty()) {
				requestedName = strParam(params, "school").trim();
			}
			if (!requestedName.isEmpty()) {
				Long authorizedSchoolId = actor.getSchoolId();
				if (authorizedSchoolId == null) {
					// Actor has no authorized school — deny unconditionally.
					log.warn("[ACCESS_GUARD] role={} has no authorizedSchoolId; denying request for school='{}'",
							actor.getRole(), requestedName);
					Map<String, Object> denied = new LinkedHashMap<>();
					denied.put("message", "ACCESS DENIED");
					denied.put("reason", "Access denied. You can only access student information for your own school.");
					return toJson(denied);
				}
				School requestedSchool = resolveSchoolByName(requestedName);
				if (requestedSchool == null) {
					// The school name was provided but no matching school was found.
					// For restricted roles, do NOT fall through to the teacher's own students.
					// Return a safe NO DATA response so the teacher's roster is never
					// mislabelled as belonging to a school that doesn't exist.
					log.warn("[ACCESS_GUARD] role={}, authorizedSchoolId={}, requestedName='{}' — school not found; returning NO DATA",
							actor.getRole(), authorizedSchoolId, requestedName);
					Map<String, Object> notFound = new LinkedHashMap<>();
					notFound.put("message", "NO DATA");
					notFound.put("reason", "The requested school was not found. You can only view data for your own school.");
					return toJson(notFound);
				}
				if (!requestedSchool.getId().equals(authorizedSchoolId)) {
					// Requested school resolves to a DIFFERENT school — deny.
					log.warn("[ACCESS_GUARD] role={}, authorizedSchoolId={}, requestedSchool='{}' (id={}) — ACCESS DENIED",
							actor.getRole(), authorizedSchoolId, requestedSchool.getName(), requestedSchool.getId());
					Map<String, Object> denied = new LinkedHashMap<>();
					denied.put("status", "FOREIGN_SCHOOL_ACCESS_DENIED");
					denied.put("message", "ACCESS DENIED. I do not have access to information for other schools.");
					denied.put("reason", "Access denied. You can only access student information for your own school.");
					return toJson(denied);
				}
				// requestedSchool.id == authorizedSchoolId — same school, allow.
				log.info("[ACCESS_GUARD] role={}, authorizedSchoolId={}, requestedName='{}' — access allowed",
						actor.getRole(), authorizedSchoolId, requestedName);
			}
		}

		// Teachers see ONLY their own assigned students.
		if (actor.getRole() == Role.TEACHER && actor.getTeacherId() != null) {
			School teacherSchool = null;
			if (actor.getSchoolId() != null) {
				teacherSchool = schoolRepository.findById(actor.getSchoolId()).orElse(null);
			}
			String teacherSchoolName = actor.getSchoolName();
			if (teacherSchoolName == null || teacherSchoolName.isBlank()) {
				if (teacherSchool != null) {
					teacherSchoolName = displayName(teacherSchool);
				} else {
					teacherSchoolName = "your assigned school";
				}
			}

			String reqSchoolName = strParam(params, "schoolName").trim();
			String userMsg = strParam(params, "userMessage").trim();
			School detectedSchool = (!userMsg.isEmpty()) ? detectMentionedSchool(userMsg) : null;

			// Check 1: User requested a foreign school (either explicitly in DB or by extracted name)
			// CRITICAL: Never expose the foreign school's name in the response.
			if (detectedSchool != null && teacherSchool != null && !detectedSchool.getId().equals(teacherSchool.getId())) {
				Map<String, Object> denied = new LinkedHashMap<>();
				denied.put("status", "FOREIGN_SCHOOL_ACCESS_DENIED");
				denied.put("assignedSchool", teacherSchoolName);
				denied.put("message", "I cannot access student details from another school. "
						+ "Please ask about students from " + teacherSchoolName
						+ " where you are currently a teacher.");
				return toJson(denied);
			}

			if (!reqSchoolName.isEmpty() && teacherSchool != null && !isSameSchool(reqSchoolName, teacherSchool)) {
				Map<String, Object> denied = new LinkedHashMap<>();
				denied.put("status", "FOREIGN_SCHOOL_ACCESS_DENIED");
				denied.put("assignedSchool", teacherSchoolName);
				denied.put("message", "I cannot access student details from another school. "
						+ "Please ask about students from " + teacherSchoolName
						+ " where you are currently a teacher.");
				return toJson(denied);
			}

			// Check 2: User asked about "school students" without specifying a school name
			if (reqSchoolName.isEmpty() && detectedSchool == null && isGenericSchoolStudentsQuery(userMsg)) {
				Map<String, Object> unspecified = new LinkedHashMap<>();
				unspecified.put("status", "SCHOOL_UNSPECIFIED");
				unspecified.put("teacherSchoolName", teacherSchoolName);
				unspecified.put("message", "Which school are you asking about? Please specify the school name so I can provide the relevant student information.");
				return toJson(unspecified);
			}

			// Check 3: Verified for teacher's assigned school (or personal query like "my students")
			List<Student> assigned = teacherAssignmentResolver.resolveAssignedStudents(actor.getTeacherId(), actor.getSchoolId());
			String filterStd = strParam(params, "standard");
			String filterDiv = strParam(params, "division");
			if (filterStd.isEmpty() && params.containsKey("grade")) {
				filterStd = strParam(params, "grade");
			}
			if (!filterStd.isEmpty() || !filterDiv.isEmpty()) {
				String normStd = normalizeStandard(filterStd);
				String normDiv = filterDiv.trim().toUpperCase(Locale.ROOT);
				assigned = assigned.stream().filter(s -> {
					String sStd = s.getStandard() != null ? normalizeStandard(s.getStandard()) : "";
					String sDiv = s.getDivision() != null ? s.getDivision().trim().toUpperCase(Locale.ROOT) : "";
					boolean matchStd = normStd.isEmpty() || normStd.equalsIgnoreCase(sStd);
					boolean matchDiv = normDiv.isEmpty() || normDiv.equalsIgnoreCase(sDiv);
					return matchStd && matchDiv;
				}).collect(Collectors.toList());
			}
			String focusName = strParam(params, "focusName").trim();
			boolean requestedSpecificStudent = !focusName.isEmpty();
			boolean studentFound = true;
			if (requestedSpecificStudent) {
				String needle = focusName.toLowerCase(Locale.ROOT);
				List<Student> namedStudents = assigned.stream().filter(s -> {
					String name = (fullName(s.getFirstName(), s.getLastName())).toLowerCase(Locale.ROOT);
					return name.contains(needle) || needle.contains(name);
				}).collect(Collectors.toList());
				if (!namedStudents.isEmpty()) {
					assigned = namedStudents;
				} else {
					studentFound = false;
					assigned = List.of();
				}
			}

			Map<String, Object> data = new LinkedHashMap<>();
			data.put("scope", "SELF (assigned students only)");
			data.put("entityType", "STUDENTS");
			data.put("schoolName", teacherSchoolName);
			data.put("status", "ASSIGNED_STUDENTS");
			data.put("field", strParam(params, "field"));
			data.put("focusName", focusName);
			data.put("requestedSpecificStudent", requestedSpecificStudent);
			data.put("studentFound", studentFound);
			data.put("studentCount", assigned.size());
			data.put("students", assigned.stream().map(this::studentView).collect(Collectors.toList()));
			String classLabel = (!filterStd.isEmpty() ? "Standard " + filterStd : "")
					+ (!filterDiv.isEmpty() ? (!filterStd.isEmpty() ? "-" : "Division ") + filterDiv : "");
			if (!classLabel.isEmpty()) {
				data.put("standard", filterStd);
				data.put("division", filterDiv);
				data.put("studentsText", assigned.size() + " student" + (assigned.size() == 1 ? "" : "s") + " assigned to you in " + classLabel + " at " + teacherSchoolName);
				data.put("summary", "You have " + assigned.size() + " student"
						+ (assigned.size() == 1 ? "" : "s") + " assigned to you at " + teacherSchoolName + " in " + classLabel + ".");
			} else {
				data.put("studentsText", assigned.size() + " student" + (assigned.size() == 1 ? "" : "s") + " assigned to you at " + teacherSchoolName);
				data.put("summary", "You are currently assigned " + assigned.size() + " student"
						+ (assigned.size() == 1 ? "" : "s") + " at " + teacherSchoolName + ".");
			}
			return toJson(data);
		}

		String focusName = strParam(params, "focusName").trim();
		String reqSchoolName = strParam(params, "schoolName").trim();
		if (reqSchoolName.isEmpty()) {
			reqSchoolName = strParam(params, "school").trim();
		}

		// CHECK 1 — Requested school resolution if explicitly specified in query params
		log.warn("[SCHOOL_ISOLATION_TRACE] actor.role={}, actor.schoolId={}, reqSchoolName='{}', focusName='{}'",
				actor.getRole(), actor.getSchoolId(), reqSchoolName, focusName);
		School requestedSchool = null;
		Long requestedSchoolId = null;
		if (!reqSchoolName.isEmpty()) {
			requestedSchool = resolveSchoolByName(reqSchoolName);
			if (requestedSchool == null) {
				Map<String, Object> empty = new LinkedHashMap<>();
				empty.put("message", "NO DATA");
				empty.put("reason", "School not found");
				empty.put("requestedSchool", reqSchoolName);
				empty.put("availableSchools", availableSchoolNames());
				return toJson(empty);
			}
			requestedSchoolId = requestedSchool.getId();
			log.warn("[SCHOOL_ISOLATION_TRACE] resolvedSchool='{}'(id={})", requestedSchool.getName(), requestedSchoolId);
		}

		// CHECK 2 — Authenticated user's authorized school
		Long authorizedSchoolId = (actor.getRole() == Role.SCHOOL_ADMIN || actor.getRole() == Role.TEACHER)
				? actor.getSchoolId()
				: null;

		// ACCESS CONTROL COMPARISON (BEFORE QUERYING STUDENT/TEACHER DATABASE)
		if (actor.getRole() == Role.SCHOOL_ADMIN || actor.getRole() == Role.TEACHER) {
			if (authorizedSchoolId == null) {
				Map<String, Object> denied = new LinkedHashMap<>();
				denied.put("message", "ACCESS DENIED");
				denied.put("reason", "Access denied. You can only access student information for your own school.");
				return toJson(denied);
			}

			if (requestedSchoolId != null && !requestedSchoolId.equals(authorizedSchoolId)) {
				// REQUESTED SCHOOL DOES NOT MATCH AUTHORIZED SCHOOL -> ACCESS DENIED!
				// STOP execution immediately BEFORE querying student database!
				log.warn("[SCHOOL_ISOLATION_TRACE] ACCESS DENIED: requestedSchoolId={} != authorizedSchoolId={}", requestedSchoolId, authorizedSchoolId);
				Map<String, Object> denied = new LinkedHashMap<>();
				denied.put("message", "ACCESS DENIED");
				denied.put("reason", "Access denied. You can only access student information for your own school.");
				return toJson(denied);
			}
		}
		log.warn("[SCHOOL_ISOLATION_TRACE] Access ALLOWED: proceeding with authorizedSchoolId={}, requestedSchoolId={}", authorizedSchoolId, requestedSchoolId);

		Long schoolId;
		List<User> teachers;
		List<Student> students;
		List<User> others;
		String schoolLabel;

		School school = (actor.getRole() == Role.SCHOOL_ADMIN || actor.getRole() == Role.TEACHER)
				? schoolRepository.findById(authorizedSchoolId).orElse(null)
				: (requestedSchool != null ? requestedSchool : null);

		if (school != null) {
			schoolId = school.getId();
			schoolLabel = displayName(school);
			teachers = userRepository.findBySchoolIdAndRole(schoolId, Role.TEACHER);
			students = studentRepository.findBySchoolId(schoolId);
			log.info("[ROSTER TRACE] School ID: {}, Name: {}, Teachers Count: {}, Students Count from DB: {}",
					schoolId, schoolLabel, teachers.size(), students.size());
			for (Student st : students) {
				log.debug("[ROSTER TRACE STUDENT] Student ID: {}, schoolId: {}",
						st.getId(), st.getSchoolId());
			}
			if (students.isEmpty()) {
				List<User> studentUsers = userRepository.findBySchoolIdAndRole(schoolId, Role.STUDENT);
				if (!studentUsers.isEmpty()) {
					students = studentUsers.stream().map(u -> {
						Student s = new Student();
						s.setId(u.getId());
						s.setFirstName(u.getFirstName());
						s.setLastName(u.getLastName());
						s.setEmail(u.getEmail());
						s.setPhone(u.getPhone());
						s.setStandard(u.getStandard());
						s.setDivision(u.getDivision());
						s.setRollNumber(u.getRollNumber());
						s.setSchoolId(u.getSchoolId());
						s.setSchoolName(u.getSchoolName());
						s.setRole(u.getRole());
						s.setStatus(u.getStatus());
						return s;
					}).collect(Collectors.toList());
				}
			}
			others = nonStudentNonTeacherUsers(schoolId);
		} else if (actor.getRole() == Role.SUPER_ADMIN) {
			// Super-Admin question that names no school ("list of all students", "give me list student name",
			// or per-person "standard of Vijay Patil"): load every school's teachers/students and locate the
			// named person if specified, or return all records across the platform.
			schoolId = null;
			schoolLabel = "All schools";
			teachers = userRepository.findByRole(Role.TEACHER);
			students = studentRepository.findAll();
			if (students.isEmpty()) {
				List<User> studentUsers = userRepository.findByRole(Role.STUDENT);
				if (!studentUsers.isEmpty()) {
					students = studentUsers.stream().map(u -> {
						Student s = new Student();
						s.setId(u.getId());
						s.setFirstName(u.getFirstName());
						s.setLastName(u.getLastName());
						s.setEmail(u.getEmail());
						s.setPhone(u.getPhone());
						s.setStandard(u.getStandard());
						s.setDivision(u.getDivision());
						s.setRollNumber(u.getRollNumber());
						s.setSchoolId(u.getSchoolId());
						s.setSchoolName(u.getSchoolName());
						s.setRole(u.getRole());
						s.setStatus(u.getStatus());
						return s;
					}).collect(Collectors.toList());
				}
			}
			others = nonStudentNonTeacherUsers(null);
		} else {
			Map<String, Object> empty = new LinkedHashMap<>();
			empty.put("message", "NO DATA");
			if (actor.getRole() == Role.SCHOOL_ADMIN) {
				empty.put("reason", "Access denied: You are only authorized to view roster data for your own school.");
				if (actor.getSchoolId() != null) {
					schoolRepository.findById(actor.getSchoolId()).ifPresent(s -> empty.put("availableSchools", List.of(displayName(s))));
				}
			} else {
				empty.put("availableSchools", availableSchoolNames());
			}
			return toJson(empty);
		}

		String entityType = strParam(params, "entityType").toLowerCase(Locale.ROOT);
		boolean wantTeachers = !entityType.equals("students");
		boolean wantStudents = !entityType.equals("teachers");
		boolean wantOthers = wantTeachers && wantStudents;

		List<String> targetClasses = new ArrayList<>();
		Object rawClasses = params.get("classes");
		if (rawClasses instanceof List<?> list) {
			for (Object item : list) {
				if (item != null && !item.toString().isBlank()) {
					targetClasses.add(item.toString().trim());
				}
			}
		}
		String requestedStandard = strParam(params, "standard").trim();
		String requestedDivision = strParam(params, "division").trim();
		if (targetClasses.isEmpty() && (!requestedStandard.isEmpty() || !requestedDivision.isEmpty())) {
			if (!requestedStandard.isEmpty() && !requestedDivision.isEmpty()) {
				targetClasses.add(requestedStandard + "-" + requestedDivision);
			}
		}
		boolean hasClassFilter = !targetClasses.isEmpty() || !requestedStandard.isEmpty() || !requestedDivision.isEmpty();
		if (hasClassFilter) {
			wantOthers = false;
		}

		Map<Long, List<String>> classesByTeacher = (wantTeachers || hasClassFilter)
				? classesByTeacherIds(teachers.stream().map(t -> t.getId()).filter(java.util.Objects::nonNull).collect(Collectors.toList()))
				: Map.of();

		List<Map<String, Object>> teacherViews = wantTeachers
				? teachers.stream()
						.map(t -> teacherView(t, classesByTeacher.getOrDefault(t.getId(), List.of())))
						.collect(Collectors.toList())
				: List.of();
		List<Map<String, Object>> studentViews = wantStudents
				? students.stream().map(this::studentView).collect(Collectors.toList())
				: List.of();
		List<Map<String, Object>> otherViews = wantOthers
				? others.stream().map(this::otherUserView).collect(Collectors.toList())
				: List.of();

		// Ensure assignedTeacher is populated for each student (from class teacher if student.teacherId was null)
		for (Map<String, Object> sv : studentViews) {
			if (sv.get("assignedTeacher") == null) {
				String sStd = String.valueOf(sv.getOrDefault("standard", "")).trim();
				String sDiv = String.valueOf(sv.getOrDefault("division", "")).trim();
				String sClass = sStd + "-" + sDiv;
				for (User t : teachers) {
					List<String> tClasses = classesByTeacher.getOrDefault(t.getId(), List.of());
					if (tClasses.stream().anyMatch(c -> classEquals(c, sClass))) {
						sv.put("assignedTeacher", fullName(t.getFirstName(), t.getLastName()));
						break;
					}
				}
			}
		}

		String queryType = strParam(params, "queryType").trim();
		String requestedDepartment = strParam(params, "department").trim();
		if (!requestedDepartment.isEmpty()) {
			String q = requestedDepartment.toLowerCase(Locale.ROOT);
			teacherViews = teacherViews.stream().filter(tv -> {
				String dept = String.valueOf(tv.getOrDefault("department", "")).toLowerCase(Locale.ROOT);
				String subj = String.valueOf(tv.getOrDefault("subject", "")).toLowerCase(Locale.ROOT);
				return dept.contains(q) || subj.contains(q);
			}).collect(Collectors.toList());
			wantTeachers = true;
			wantStudents = false;
			wantOthers = false;
		}

		String requestedRollNumber = strParam(params, "rollNumber").trim();
		if (!requestedRollNumber.isEmpty()) {
			studentViews = studentViews.stream().filter(sv -> {
				String roll = String.valueOf(sv.getOrDefault("rollNumber", "")).trim();
				return roll.equalsIgnoreCase(requestedRollNumber);
			}).collect(Collectors.toList());
			wantStudents = true;
			wantTeachers = false;
			wantOthers = false;
		}

		if (queryType.equals("TEACHER_MAX_CLASSES")) {
			wantTeachers = true;
			wantStudents = false;
			wantOthers = false;
			teacherViews.sort((a, b) -> {
				int cA = Integer.parseInt(String.valueOf(a.getOrDefault("classCount", "0")));
				int cB = Integer.parseInt(String.valueOf(b.getOrDefault("classCount", "0")));
				return Integer.compare(cB, cA);
			});
		}

		// Narrow to one named person when the question asks about their stored
		// attributes ("which department is Digvijay Patil in", "which subject does
		// he teach", "when did he join the school"). Keeps the payload focused and
		// the answer unambiguous; falls back to the full roster when the name
		// matches nobody so a broad list question is never emptied by accident.
		if (!focusName.isBlank() && !queryType.equals("TEACHER_STUDENTS_PROGRESS")) {
			boolean teacherMatch = matchesName(teacherViews, focusName);
			boolean studentMatch = matchesName(studentViews, focusName);
			boolean otherMatch = matchesName(otherViews, focusName);
			if (teacherMatch || studentMatch || otherMatch) {
				teacherViews = teacherMatch ? filterByName(teacherViews, focusName) : List.of();
				studentViews = studentMatch ? filterByName(studentViews, focusName) : List.of();
				otherViews = otherMatch ? filterByName(otherViews, focusName) : List.of();
				wantTeachers = teacherMatch;
				wantStudents = studentMatch;
				wantOthers = otherMatch;
			}
		}

		// Narrow to a requested class/standard/division (e.g. "7-B", "9th A students", "standard 9 division A"):
		if (wantTeachers && hasClassFilter) {
			teacherViews = teacherViews.stream().filter(tv -> {
				Object cList = tv.get("classes");
				List<String> assigned = cList instanceof List<?> list
						? list.stream().map(String::valueOf).collect(Collectors.toList())
						: List.of();
				if (!targetClasses.isEmpty()) {
					for (String target : targetClasses) {
						for (String c : assigned) {
							if (classEquals(c, target)) {
								return true;
							}
						}
					}
					return false;
				}
				if (!requestedStandard.isEmpty() && !requestedDivision.isEmpty()) {
					String target = requestedStandard + "-" + requestedDivision;
					for (String c : assigned) {
						if (classEquals(c, target)) {
							return true;
						}
					}
					return false;
				}
				if (!requestedStandard.isEmpty()) {
					for (String c : assigned) {
						if (classMatchesStandard(c, requestedStandard)) {
							return true;
						}
					}
					return false;
				}
				return false;
			}).collect(Collectors.toList());
		}

		if (wantStudents && hasClassFilter) {
			studentViews = studentViews.stream().filter(sv -> {
				String sStd = String.valueOf(sv.getOrDefault("standard", "")).trim();
				String sDiv = String.valueOf(sv.getOrDefault("division", "")).trim();
				String sClass = sStd + "-" + sDiv;
				if (!targetClasses.isEmpty()) {
					for (String target : targetClasses) {
						if (classEquals(sClass, target)) {
							return true;
						}
					}
					return false;
				}
				boolean matchStd = requestedStandard.isEmpty()
						|| requestedStandard.equalsIgnoreCase(sStd);
				boolean matchDiv = requestedDivision.isEmpty()
						|| requestedDivision.equalsIgnoreCase(sDiv);
				return matchStd && matchDiv;
			}).collect(Collectors.toList());
		}

		List<Map<String, Object>> classAssignments = new ArrayList<>();
		if (wantTeachers && !targetClasses.isEmpty()) {
			for (String target : targetClasses) {
				Map<String, Object> ca = new LinkedHashMap<>();
				ca.put("class", target);
				List<String> assignedTeacherNames = new ArrayList<>();
				for (User t : teachers) {
					List<String> tClasses = classesByTeacher.getOrDefault(t.getId(), List.of());
					if (tClasses.stream().anyMatch(c -> classEquals(c, target))) {
						assignedTeacherNames.add(fullName(t.getFirstName(), t.getLastName()));
					}
				}
				long stdCount = students.stream().filter(s -> {
					String sStd = s.getStandard() != null ? s.getStandard().trim() : "";
					String sDiv = s.getDivision() != null ? s.getDivision().trim() : "";
					return classEquals(sStd + "-" + sDiv, target);
				}).count();

				ca.put("teachers", assignedTeacherNames);
				ca.put("hasTeacher", !assignedTeacherNames.isEmpty());
				ca.put("teacher", assignedTeacherNames.isEmpty() ? null : String.join(", ", assignedTeacherNames));
				ca.put("studentCount", stdCount);
				classAssignments.add(ca);
			}
		}

		Map<String, Object> data = new LinkedHashMap<>();
		data.put("scope", schoolId == null ? "PLATFORM (all schools)" : "SCHOOL (id=" + schoolId + ")");
		data.put("schoolName", schoolLabel);
		if (!requestedStandard.isEmpty()) {
			data.put("standard", requestedStandard);
		}
		if (!requestedDivision.isEmpty()) {
			data.put("division", requestedDivision);
		}
		if (!targetClasses.isEmpty()) {
			data.put("classes", targetClasses);
		}
		if (!classAssignments.isEmpty()) {
			data.put("classAssignments", classAssignments);
		}
		if (focusName.isBlank()) {
			data.put("entityType", entityType.isBlank() ? "BOTH" : entityType.toUpperCase(Locale.ROOT));
		} else {
			data.put("entityType", "SINGLE_PERSON");
			data.put("focusName", focusName);
		}
		if (wantTeachers || hasClassFilter) {
			data.put("teacherCount", teacherViews.size());
			data.put("teachers", teacherViews);
			data.put("teachersText", teacherViews.size() + " teacher" + (teacherViews.size() == 1 ? "" : "s"));
		}
		if (wantStudents || hasClassFilter) {
			data.put("studentCount", studentViews.size());
			data.put("students", studentViews);
			data.put("studentsText", studentViews.size() + " student" + (studentViews.size() == 1 ? "" : "s"));
		}
		if (wantOthers) {
			data.put("otherUserCount", otherViews.size());
			data.put("otherUsers", otherViews);
			data.put("otherUsersText", otherViews.size() + " other user" + (otherViews.size() == 1 ? "" : "s"));
		}
		if (queryType.equals("TEACHER_MAX_CLASSES")) {
			Map<String, Object> topTeacher = teacherViews.stream()
					.max(Comparator.comparingInt(tv -> Integer.parseInt(String.valueOf(tv.getOrDefault("classCount", "0")))))
					.orElse(null);
			if (topTeacher != null) {
				data.put("topTeacherByClasses", topTeacher);
			}
		}

		if (studentViews.size() == 1) {
			Map<String, Object> sView = studentViews.get(0);
			if (sView.get("assignedTeacher") != null) {
				data.put("studentAssignedTeacher", sView.get("assignedTeacher"));
			}
		}

		if (queryType.equals("TEACHER_STUDENTS_PROGRESS") && !focusName.isBlank()) {
			User teacher = teachers.stream()
					.filter(t -> fullName(t.getFirstName(), t.getLastName()).toLowerCase(Locale.ROOT).contains(focusName.toLowerCase(Locale.ROOT)))
					.findFirst().orElse(null);
			if (teacher != null) {
				List<String> tClasses = classesByTeacher.getOrDefault(teacher.getId(), List.of());
				List<Student> assignedStudents = students.stream().filter(st -> {
					if (teacher.getId().equals(st.getTeacherId())) return true;
					String stClass = (st.getStandard() != null ? st.getStandard().trim() : "") + "-" + (st.getDivision() != null ? st.getDivision().trim() : "");
					return tClasses.stream().anyMatch(tc -> classEquals(tc, stClass));
				}).collect(Collectors.toList());

				List<Map<String, Object>> progressList = new ArrayList<>();
				long totalXp = 0;
				int activeCount = 0;
				for (Student st : assignedStudents) {
					Map<String, Object> item = new LinkedHashMap<>();
					item.put("name", fullName(st.getFirstName(), st.getLastName()));
					item.put("standard", st.getStandard() != null ? st.getStandard() : "");
					item.put("division", st.getDivision() != null ? st.getDivision() : "");
					Progress prog = progressRepository.findByStudent(st).orElse(null);
					int xp = prog != null && prog.getXp() != null ? prog.getXp() : 0;
					int level = prog != null && prog.getLevel() != null ? prog.getLevel() : 1;
					int streak = prog != null && prog.getCurrentStreak() != null ? prog.getCurrentStreak() : 0;
					item.put("xp", xp);
					item.put("level", level);
					item.put("streak", streak);
					totalXp += xp;
					if (xp > 0 || streak > 0) activeCount++;
					progressList.add(item);
				}
				Map<String, Object> tsp = new LinkedHashMap<>();
				String tName = fullName(teacher.getFirstName(), teacher.getLastName());
				tsp.put("teacherName", tName);
				tsp.put("studentCount", assignedStudents.size());
				tsp.put("activeStudents", activeCount);
				tsp.put("totalXp", totalXp);
				tsp.put("students", progressList);
				data.put("teacherStudentsProgress", tsp);
			}
		}
		int shownTeachers = wantTeachers ? teacherViews.size() : 0;
		int shownStudents = wantStudents ? studentViews.size() : 0;
		int shownOthers = wantOthers ? otherViews.size() : 0;
		String summary;
		if (data.containsKey("teacherStudentsProgress")) {
			@SuppressWarnings("unchecked")
			Map<String, Object> tsp = (Map<String, Object>) data.get("teacherStudentsProgress");
			summary = tsp.get("teacherName") + "'s assigned students: " + tsp.get("studentCount")
					+ " students, total XP: " + tsp.get("totalXp") + " (" + tsp.get("activeStudents") + " active).";
		} else if (data.containsKey("studentAssignedTeacher") && !studentViews.isEmpty()) {
			String sName = String.valueOf(studentViews.get(0).get("name"));
			String tName = String.valueOf(data.get("studentAssignedTeacher"));
			summary = "Teacher for student " + sName + ": " + tName + " (assigned teacher).";
		} else if (data.containsKey("topTeacherByClasses")) {
			@SuppressWarnings("unchecked")
			Map<String, Object> tt = (Map<String, Object>) data.get("topTeacherByClasses");
			summary = tt.get("name") + " has the most classes to handle, with " + tt.get("classCount") + " assigned classes.";
		} else
		if (!classAssignments.isEmpty() && wantTeachers) {
			if (classAssignments.size() == 1) {
				Map<String, Object> ca = classAssignments.get(0);
				String cName = String.valueOf(ca.get("class"));
				long sCount = ((Number) ca.getOrDefault("studentCount", 0)).longValue();
				if (Boolean.TRUE.equals(ca.get("hasTeacher"))) {
					summary = "Teacher for class " + cName + ": " + ca.get("teacher")
							+ " (" + sCount + " student" + (sCount == 1 ? "" : "s") + " enrolled).";
				} else {
					summary = "No teacher is assigned to class " + cName + " in the current data ("
							+ sCount + " student" + (sCount == 1 ? "" : "s") + " enrolled).";
				}
			} else {
				List<String> parts = new ArrayList<>();
				for (Map<String, Object> ca : classAssignments) {
					String cName = String.valueOf(ca.get("class"));
					if (Boolean.TRUE.equals(ca.get("hasTeacher"))) {
						parts.add(cName + ": " + ca.get("teacher"));
					} else {
						parts.add(cName + ": No teacher assigned");
					}
				}
				summary = "Teacher assignments: " + String.join(", ", parts) + ".";
			}
		} else if (wantTeachers && !wantStudents) {
			summary = schoolLabel + " has " + shownTeachers + " teacher" + (shownTeachers == 1 ? "" : "s") + ".";
		} else if (wantStudents && !wantTeachers) {
			if (!requestedStandard.isEmpty() || !requestedDivision.isEmpty()) {
				String classLabel = (!requestedStandard.isEmpty() ? "Standard " + requestedStandard : "")
						+ (!requestedDivision.isEmpty() ? (!requestedStandard.isEmpty() ? "-" : "Division ") + requestedDivision : "");
				summary = schoolLabel + " has " + shownStudents + " student" + (shownStudents == 1 ? "" : "s") + " in " + classLabel + ".";
			} else {
				summary = schoolLabel + " has " + shownStudents + " student" + (shownStudents == 1 ? "" : "s") + ".";
			}
		} else {
			summary = schoolLabel + " has " + shownTeachers + " teacher"
					+ (shownTeachers == 1 ? "" : "s") + " and " + shownStudents + " student"
					+ (shownStudents == 1 ? "" : "s") + ".";
		}
		if (shownOthers > 0 && shownTeachers == 0 && shownStudents == 0) {
			// The question narrowed onto a single non-teaching, non-student account (a
			// platform USER, School Admin or Admin). State who the person really is and
			// why a learning metric such as XP does not apply to them, instead of
			// degrading to the generic "information not available" reply.
			Map<String, Object> person = otherViews.get(0);
			StringBuilder focus = new StringBuilder(String.valueOf(person.get("name")))
					.append(" is a ").append(String.valueOf(person.getOrDefault("role", "User")))
					.append(" (not a student or teacher).");
			Object email = person.get("email");
			if (email != null && !email.toString().isBlank()) {
				focus.append(" Email: ").append(email).append('.');
			}
			focus.append(" XP, levels, streaks and lesson/activity metrics are recorded only")
					.append(" for student accounts, so there are no learning metrics for this user.");
			summary = focus.toString();
		}
		data.put("summary", summary);
		return toJson(data);
	}

	/**
	 * Full teacher profile: the base profile fields (name/email/phone) that live on
	 * {@link User}, every teacher-specific field present in the DB
	 * (department/designation/employeeId/experience/qualification/joinedAt) and the
	 * classes the teacher is assigned to. The teaching area is exposed twice - as
	 * {@code department} (its real column name) and as {@code subject} (the word
	 * users actually ask with).
	 *
	 * <p>Extra detail is loaded via {@link TeacherRepository} keyed by the user id.
	 * With JPA joined inheritance the {@code users} row and the {@code teachers} row
	 * share the same primary key, so the id match always works, and it does not rely
	 * on the {@code teachers.user_id} back-reference (which the live data leaves NULL).
	 */
	private Map<String, Object> teacherView(User teacher, List<String> assignedClasses) {
		Map<String, Object> view = new LinkedHashMap<>();
		String name = fullName(teacher.getFirstName(), teacher.getLastName());
		view.put("name", name);
		view.put("email", teacher.getEmail());
		putIfPresent(view, "phone", teacher.getPhone());
		putIfPresent(view, "schoolName", teacher.getSchoolName());
		List<String> classes = assignedClasses != null ? assignedClasses : List.of();
		view.put("classes", classes);
		view.put("classCount", classes.size());

		Long teacherUserId = teacher.getId();
		if (teacherUserId != null) {
			List<Student> teacherStudents = null;
			try {
				teacherStudents = teacherAssignmentResolver.resolveAssignedStudents(teacherUserId, teacher.getSchoolId());
			} catch (Exception ignored) {
			}
			if (teacherStudents == null || teacherStudents.isEmpty()) {
				try {
					teacherStudents = studentRepository.findByTeacherId(teacherUserId);
				} catch (Exception ignored) {
				}
			}
			int sCount = teacherStudents != null ? teacherStudents.size() : 0;
			view.put("studentCount", sCount);
			view.put("hasStudents", sCount > 0);
			if (teacherStudents != null && !teacherStudents.isEmpty()) {
				view.put("assignedStudents", teacherStudents.stream()
						.map(s -> fullName(s.getFirstName(), s.getLastName()))
						.collect(Collectors.toList()));
			}
		} else {
			view.put("studentCount", 0);
			view.put("hasStudents", false);
		}

		Teacher details = teacherUserId != null ? teacherRepository.findById(teacherUserId).orElse(null) : null;
		if (details != null) {
			putIfPresent(view, "employeeId", details.getEmployeeId());
			putIfPresent(view, "department", details.getDepartment());
			// The word users ask with is "subject"; the stored column is "department".
			putIfPresent(view, "subject", details.getDepartment());
			putIfPresent(view, "designation", details.getDesignation());
			putIfPresent(view, "experience", details.getExperience());
			putIfPresent(view, "qualification", details.getQualification());
			if (details.getJoinedAt() != null) {
				view.put("joinedAt", JOINED_DATE.format(details.getJoinedAt()));
			}
		}
		return view;
	}

	/**
	 * Full student profile: base profile fields (name/email/phone) plus the
	 * student-specific fields present in the DB (studentId, standard, division)
	 * and the name of the teacher the student is assigned to.
	 */
	private Map<String, Object> studentView(Student student) {
		Map<String, Object> view = new LinkedHashMap<>();
		view.put("name", fullName(student.getFirstName(), student.getLastName()));
		view.put("email", student.getEmail());
		putIfPresent(view, "phone", student.getPhone());
		putIfPresent(view, "schoolName", student.getSchoolName());
		putIfPresent(view, "studentId", student.getStudentId());
		putIfPresent(view, "standard", student.getStandard());
		putIfPresent(view, "division", student.getDivision());
		putIfPresent(view, "rollNumber", student.getRollNumber());
		Long assignedTeacherId = student.getTeacherId();
		if (assignedTeacherId != null) {
			view.put("teacherId", assignedTeacherId);
			User assignedTeacher = userRepository.findById(assignedTeacherId).orElse(null);
			if (assignedTeacher != null) {
				view.put("assignedTeacher", fullName(assignedTeacher.getFirstName(), assignedTeacher.getLastName()));
			}
		}
		return view;
	}

	/**
	 * Teacher id -> the class labels ("5-A", "6-B") the teacher is assigned to,
	 * resolved through teacher_standard_divisions -> standard_divisions ->
	 * school_standards. Loaded in a single eager-fetch query to avoid N+1 and to
	 * keep the lazy associations out of the payload path; any failure degrades to
	 * "no classes" rather than breaking the roster answer.
	 */
	private Map<Long, List<String>> classesByTeacherIds(List<Long> teacherIds) {
		Map<Long, List<String>> grouped = new LinkedHashMap<>();
		if (teacherIds == null || teacherIds.isEmpty()) {
			return grouped;
		}
		List<TeacherStandardDivision> links;
		try {
			links = teacherStandardDivisionRepository.findWithClassesByTeacherIdIn(teacherIds);
		} catch (Exception e) {
			return grouped;
		}
		if (links == null || links.isEmpty()) {
			return grouped;
		}
		for (TeacherStandardDivision link : links) {
			if (link.getTeacher() == null || link.getStandardDivision() == null) {
				continue;
			}
			SchoolStandard schoolStandard = link.getStandardDivision().getSchoolStandard();
			String standard = schoolStandard != null ? schoolStandard.getStandard() : null;
			String label = joinStandardDivision(standard, link.getStandardDivision().getDivision());
			if (label.isBlank()) {
				continue;
			}
			List<String> labels = grouped.computeIfAbsent(link.getTeacher().getId(), k -> new ArrayList<>());
			if (!labels.contains(label)) {
				labels.add(label);
			}
		}
		return grouped;
	}

	private String joinStandardDivision(String standard, String division) {
		String s = standard == null ? "" : standard.trim();
		String d = division == null ? "" : division.trim();
		if (s.isEmpty()) {
			return d;
		}
		if (d.isEmpty()) {
			return s;
		}
		return s + "-" + d;
	}

	private boolean classEquals(String c1, String c2) {
		if (c1 == null || c2 == null) {
			return false;
		}
		String norm1 = c1.replace("-", "").replace(" ", "").trim().toUpperCase(Locale.ROOT);
		String norm2 = c2.replace("-", "").replace(" ", "").trim().toUpperCase(Locale.ROOT);
		return norm1.equalsIgnoreCase(norm2);
	}

	private boolean classMatchesStandard(String classLabel, String standard) {
		if (classLabel == null || standard == null) {
			return false;
		}
		String[] parts = classLabel.split("-");
		if (parts.length > 0) {
			return parts[0].trim().equalsIgnoreCase(standard.trim());
		}
		return false;
	}

	private boolean matchesName(List<Map<String, Object>> views, String focusName) {
		String needle = focusName.toLowerCase(Locale.ROOT);
		return views.stream().anyMatch(v -> hasNameMatch(v, needle));
	}

	private List<Map<String, Object>> filterByName(List<Map<String, Object>> views, String focusName) {
		String needle = focusName.toLowerCase(Locale.ROOT);
		return views.stream().filter(v -> hasNameMatch(v, needle)).collect(Collectors.toList());
	}

	private boolean hasNameMatch(Map<String, Object> view, String needleLower) {
		Object name = view.get("name");
		return name != null && name.toString().toLowerCase(Locale.ROOT).contains(needleLower);
	}

	private void putIfPresent(Map<String, Object> view, String key, String value) {
		if (value != null && !value.isBlank()) {
			view.put(key, value);
		}
	}

	private String fullName(String first, String last) {
		String f = first != null ? first : "";
		String l = last != null ? last : "";
		return (f + " " + l).trim();
	}

	/**
	 * Users whose role is neither STUDENT nor TEACHER (platform USERs, School
	 * Admins, Admins). Their profile is real data a Super Admin may ask for even
	 * though they have no learning record. When {@code schoolId} is null every such
	 * user on the platform is returned.
	 */
	private List<User> nonStudentNonTeacherUsers(Long schoolId) {
		List<User> candidates = (schoolId != null) ? userRepository.findBySchoolId(schoolId) : userRepository.findAll();
		return candidates.stream()
				.filter(u -> u.getRole() != Role.STUDENT && u.getRole() != Role.TEACHER)
				.collect(Collectors.toList());
	}

	/**
	 * Profile view for a user who is neither a teacher nor a student. Mirrors
	 * {@link #teacherView}/{@link #studentView} so a named non-teaching person still
	 * renders as a real person block instead of degrading to "not available".
	 */
	private Map<String, Object> otherUserView(User u) {
		Map<String, Object> view = new LinkedHashMap<>();
		view.put("name", fullName(u.getFirstName(), u.getLastName()));
		view.put("role", roleLabel(u.getRole()));
		view.put("email", u.getEmail());
		putIfPresent(view, "phone", u.getPhone());
		putIfPresent(view, "schoolName", u.getSchoolName());
		putIfPresent(view, "status", u.isActive() ? "Active" : "Inactive");
		return view;
	}

	private String roleLabel(Role role) {
		if (role == null) {
			return "User";
		}
		return switch (role) {
			case SUPER_ADMIN -> "Super Admin";
			case SCHOOL_ADMIN -> "School Admin";
			case ADMIN -> "Admin";
			case TEACHER -> "Teacher";
			case STUDENT -> "Student";
			case USER -> "User";
		};
	}



	/**
	 * Resolves a {@link School} by its display name (or short name). Tries exact
	 * match first, then case-insensitive exact, then a fuzzy key match that strips
	 * spaces and punctuation. Returns {@code null} when no school is found.
	 */
	private School resolveSchoolByName(String name) {
		if (name == null || name.isBlank()) {
			return null;
		}
		// 1) Exact match via repository
		Optional<School> exact = schoolRepository.findByName(name);
		if (exact.isPresent()) {
			return exact.get();
		}
		// 2) Case-insensitive exact via repository
		Optional<School> exactIgnoreCase = schoolRepository.findByNameIgnoreCase(name);
		if (exactIgnoreCase.isPresent()) {
			return exactIgnoreCase.get();
		}
		// 3) Fuzzy key match (strips spaces/punctuation)
		String needle = schoolKey(name);
		String needleCore = coreSchoolKey(name);
		if (needle.isEmpty()) {
			return null;
		}
		List<School> all = schoolRepository.findAll();
		return all.stream()
				.filter(s -> {
					String full = schoolKey(displayName(s));
					String shortName = schoolKey(s.getName());
					if (full.contains(needle) || needle.contains(full)
							|| (!shortName.isEmpty()
									&& (shortName.contains(needle) || needle.contains(shortName)))) {
						return true;
					}
					if (!needleCore.isEmpty()) {
						String fullCore = coreSchoolKey(displayName(s));
						String shortCore = coreSchoolKey(s.getName());
						return fullCore.contains(needleCore) || needleCore.contains(fullCore)
								|| (!shortCore.isEmpty()
										&& (shortCore.contains(needleCore) || needleCore.contains(shortCore)));
					}
					return false;
				})
				.findFirst()
				.orElse(null);
	}


	/**
		* Normalizes a school name for matching: lower-cased with all whitespace and
		* punctuation removed, so "St. Vincent High School" and "St.Vincent
		* Highschool" collapse to the same key. Only alphanumerics survive.
		*/
	private String schoolKey(String value) {
		if (value == null) {
			return "";
		}
		return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
	}

	private String schoolRootKey(String value) {
		if (value == null) {
			return "";
		}
		return value.toLowerCase(Locale.ROOT)
				.replaceAll("\\b(school|schools|highschool|high school|academy|college|institute|university|vidyalaya|public|international|campus|vidyamandir|gurukul|high)\\b", "")
				.replaceAll("[^a-z0-9]", "")
				.trim();
	}

	private String coreSchoolKey(String value) {
		return schoolRootKey(value);
	}

	private boolean isSameSchool(String candidate, School school) {
		if (candidate == null || candidate.isBlank() || school == null) {
			return false;
		}
		String reqKey = schoolKey(candidate);
		String ownKey = schoolKey(displayName(school));
		String ownShort = schoolKey(school.getName());
		String ownCode = schoolKey(school.getSchoolCode());

		if (reqKey.equals(ownKey) || reqKey.equals(ownShort) || (!ownCode.isEmpty() && reqKey.equals(ownCode))) {
			return true;
		}
		if (ownKey.contains(reqKey) || reqKey.contains(ownKey)
				|| (!ownShort.isEmpty() && (ownShort.contains(reqKey) || reqKey.contains(ownShort)))) {
			return true;
		}

		String reqRoot = schoolRootKey(candidate);
		String ownRoot = schoolRootKey(displayName(school));
		String shortRoot = schoolRootKey(school.getName());

		if (!reqRoot.isEmpty()) {
			if (!ownRoot.isEmpty() && (reqRoot.equals(ownRoot) || reqRoot.contains(ownRoot) || ownRoot.contains(reqRoot))) {
				return true;
			}
			if (!shortRoot.isEmpty() && (reqRoot.equals(shortRoot) || reqRoot.contains(shortRoot) || shortRoot.contains(reqRoot))) {
				return true;
			}
		}
		return false;
	}

	private School detectMentionedSchool(String message) {
		if (message == null || message.isBlank()) {
			return null;
		}
		String m = message.toLowerCase(Locale.ROOT);
		List<School> all = new ArrayList<>(schoolRepository.findAll());
		all.sort((a, b) -> Integer.compare(
				displayName(b).length(),
				displayName(a).length()
		));
		for (School s : all) {
			String name = s.getName() != null ? s.getName().toLowerCase(Locale.ROOT) : "";
			String disp = displayName(s).toLowerCase(Locale.ROOT);
			String code = s.getSchoolCode() != null ? s.getSchoolCode().toLowerCase(Locale.ROOT) : "";
			String root = schoolRootKey(disp);

			if (!name.isEmpty() && m.contains(name)) {
				return s;
			}
			if (!disp.isEmpty() && m.contains(disp)) {
				return s;
			}
			if (!code.isEmpty() && m.matches(".*\\b" + Pattern.quote(code) + "\\b.*")) {
				return s;
			}
			if (!root.isEmpty() && root.length() >= 3 && m.matches(".*\\b" + Pattern.quote(root) + "\\b.*")) {
				return s;
			}
		}
		return null;
	}

	private boolean isGenericSchoolStudentsQuery(String message) {
		if (message == null || message.isBlank()) {
			return false;
		}
		String m = message.toLowerCase(Locale.ROOT).trim();
		boolean hasSchoolWord = m.contains("school");
		if (!hasSchoolWord) {
			return false;
		}
		boolean hasStudentWord = m.contains("student") || m.contains("learner") || m.contains("teacher");
		if (!hasStudentWord) {
			return false;
		}
		if (m.contains("my school") || m.contains("our school") || m.contains("assigned school")
				|| m.contains("my student") || m.contains("my students") || m.contains("assigned to me")
				|| m.contains("i teach")) {
			return false;
		}
		return true;
	}

	private String displayName(School school) {
		return school.getSchoolName() != null ? school.getSchoolName() : school.getName();
	}

	private List<String> availableSchoolNames() {
		return schoolRepository.findAll().stream()
				.map(this::displayName)
				.collect(Collectors.toList());
	}

	private String strParam(Map<String, Object> params, String key) {
		if (params == null) {
			return "";
		}
		Object value = params.get(key);
		return value == null ? "" : value.toString();
	}

	private static String normalizeStandard(String value) {
		if (value == null) {
			return "";
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty()) {
			return "";
		}
		java.util.regex.Matcher digits = java.util.regex.Pattern.compile("\\d+").matcher(trimmed);
		if (digits.find()) {
			return digits.group();
		}
		return trimmed.toLowerCase(Locale.ROOT)
				.replaceAll("(?i)standard|grade|class", "")
				.replaceAll("(?i)th|st|nd|rd", "")
				.replaceAll("\\s+", "");
	}

	private String toJson(Map<String, Object> data) {
		try {
			return objectMapper.writeValueAsString(data);
		} catch (JsonProcessingException e) {
			return "NO DATA";
		}
	}
}
