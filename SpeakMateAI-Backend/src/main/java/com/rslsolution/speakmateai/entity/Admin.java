package com.rslsolution.speakmateai.entity;

import java.time.LocalDateTime;

import com.rslsolution.speakmateai.enums.AdminStatus;
import com.rslsolution.speakmateai.enums.Role;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "admins")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Admin {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@NotBlank(message = "Full name is required")
	@Column(nullable = false)
	private String fullName;

	@NotBlank(message = "Email is required")
	@Email(message = "Invalid email format")
	@Column(nullable = false, unique = true)
	private String email;

	@NotBlank(message = "Password is required")
	@Column(nullable = false)
	private String password;

	private String phone;

	@Column(columnDefinition = "TEXT")
	private String profileImage;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Role role;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AdminStatus status;

	private LocalDateTime lastLogin;

	// --- Profile Fields ---
	private String department;
	private String designation;
	private String location;

	// --- Settings Fields ---
	@Builder.Default
	private String theme = "LIGHT";

	@Builder.Default
	private String language = "en";

	@Builder.Default
	private Boolean sidebarCollapsed = false;

	@Builder.Default
	private Boolean notificationsEnabled = true;

	@Builder.Default
	private Boolean emailNotifications = true;

	@Builder.Default
	private Boolean systemNotifications = true;

	@Builder.Default
	private Boolean twoFactorEnabled = false;

	@Builder.Default
	private int sessionTimeout = 30;

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@Column(nullable = false)
	private LocalDateTime updatedAt;

	private String resetPasswordToken;

	private LocalDateTime resetPasswordTokenExpiry;

	private String resetOtp;

	private LocalDateTime resetOtpExpiry;

	@Builder.Default
	private Integer resetOtpAttempts = 0;

	@PrePersist
	public void onCreate() {
		createdAt = LocalDateTime.now();
		updatedAt = LocalDateTime.now();
	}

	@PreUpdate
	public void onUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public Long getId() { return id; }
	public void setId(Long id) { this.id = id; }

	public String getFullName() { return fullName; }
	public void setFullName(String fullName) { this.fullName = fullName; }

	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = email; }

	public String getPassword() { return password; }
	public void setPassword(String password) { this.password = password; }

	public String getPhone() { return phone; }
	public void setPhone(String phone) { this.phone = phone; }

	public String getProfileImage() { return profileImage; }
	public void setProfileImage(String profileImage) { this.profileImage = profileImage; }

	public Role getRole() { return role; }
	public void setRole(Role role) { this.role = role; }

	public AdminStatus getStatus() { return status; }
	public void setStatus(AdminStatus status) { this.status = status; }

	public LocalDateTime getLastLogin() { return lastLogin; }
	public void setLastLogin(LocalDateTime lastLogin) { this.lastLogin = lastLogin; }

	public String getDepartment() { return department; }
	public void setDepartment(String department) { this.department = department; }

	public String getDesignation() { return designation; }
	public void setDesignation(String designation) { this.designation = designation; }

	public String getLocation() { return location; }
	public void setLocation(String location) { this.location = location; }

	public String getTheme() { return theme; }
	public void setTheme(String theme) { this.theme = theme; }

	public String getLanguage() { return language; }
	public void setLanguage(String language) { this.language = language; }

	public Boolean getSidebarCollapsed() { return sidebarCollapsed; }
	public void setSidebarCollapsed(Boolean sidebarCollapsed) { this.sidebarCollapsed = sidebarCollapsed; }

	public Boolean getNotificationsEnabled() { return notificationsEnabled; }
	public void setNotificationsEnabled(Boolean notificationsEnabled) { this.notificationsEnabled = notificationsEnabled; }

	public Boolean getEmailNotifications() { return emailNotifications; }
	public void setEmailNotifications(Boolean emailNotifications) { this.emailNotifications = emailNotifications; }

	public Boolean getSystemNotifications() { return systemNotifications; }
	public void setSystemNotifications(Boolean systemNotifications) { this.systemNotifications = systemNotifications; }

	public Boolean getTwoFactorEnabled() { return twoFactorEnabled; }
	public void setTwoFactorEnabled(Boolean twoFactorEnabled) { this.twoFactorEnabled = twoFactorEnabled; }

	public int getSessionTimeout() { return sessionTimeout; }
	public void setSessionTimeout(int sessionTimeout) { this.sessionTimeout = sessionTimeout; }

	public LocalDateTime getCreatedAt() { return createdAt; }
	public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

	public String getResetPasswordToken() { return resetPasswordToken; }
	public void setResetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; }

	public LocalDateTime getResetPasswordTokenExpiry() { return resetPasswordTokenExpiry; }
	public void setResetPasswordTokenExpiry(LocalDateTime resetPasswordTokenExpiry) { this.resetPasswordTokenExpiry = resetPasswordTokenExpiry; }

	public String getResetOtp() { return resetOtp; }
	public void setResetOtp(String resetOtp) { this.resetOtp = resetOtp; }

	public LocalDateTime getResetOtpExpiry() { return resetOtpExpiry; }
	public void setResetOtpExpiry(LocalDateTime resetOtpExpiry) { this.resetOtpExpiry = resetOtpExpiry; }

	public static AdminBuilder builder() {
		return new AdminBuilder();
	}

	public static class AdminBuilder {
		private Long id;
		private String fullName;
		private String email;
		private String password;
		private String phone;
		private String profileImage;
		private Role role;
		private AdminStatus status;
		private LocalDateTime lastLogin;
		private String department;
		private String designation;
		private String location;
		private String theme = "LIGHT";
		private String language = "en";
		private Boolean sidebarCollapsed = false;
		private Boolean notificationsEnabled = true;
		private Boolean emailNotifications = true;
		private Boolean systemNotifications = true;
		private Boolean twoFactorEnabled = false;
		private int sessionTimeout = 30;
		private LocalDateTime createdAt;
		private LocalDateTime updatedAt;
		private String resetPasswordToken;
		private LocalDateTime resetPasswordTokenExpiry;
		private String resetOtp;
		private LocalDateTime resetOtpExpiry;

		public AdminBuilder id(Long id) { this.id = id; return this; }
		public AdminBuilder fullName(String fullName) { this.fullName = fullName; return this; }
		public AdminBuilder email(String email) { this.email = email; return this; }
		public AdminBuilder password(String password) { this.password = password; return this; }
		public AdminBuilder phone(String phone) { this.phone = phone; return this; }
		public AdminBuilder profileImage(String profileImage) { this.profileImage = profileImage; return this; }
		public AdminBuilder role(Role role) { this.role = role; return this; }
		public AdminBuilder status(AdminStatus status) { this.status = status; return this; }
		public AdminBuilder lastLogin(LocalDateTime lastLogin) { this.lastLogin = lastLogin; return this; }
		public AdminBuilder department(String department) { this.department = department; return this; }
		public AdminBuilder designation(String designation) { this.designation = designation; return this; }
		public AdminBuilder location(String location) { this.location = location; return this; }
		public AdminBuilder theme(String theme) { this.theme = theme; return this; }
		public AdminBuilder language(String language) { this.language = language; return this; }
		public AdminBuilder sidebarCollapsed(Boolean sidebarCollapsed) { this.sidebarCollapsed = sidebarCollapsed; return this; }
		public AdminBuilder notificationsEnabled(Boolean notificationsEnabled) { this.notificationsEnabled = notificationsEnabled; return this; }
		public AdminBuilder emailNotifications(Boolean emailNotifications) { this.emailNotifications = emailNotifications; return this; }
		public AdminBuilder systemNotifications(Boolean systemNotifications) { this.systemNotifications = systemNotifications; return this; }
		public AdminBuilder twoFactorEnabled(Boolean twoFactorEnabled) { this.twoFactorEnabled = twoFactorEnabled; return this; }
		public AdminBuilder sessionTimeout(int sessionTimeout) { this.sessionTimeout = sessionTimeout; return this; }
		public AdminBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
		public AdminBuilder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
		public AdminBuilder resetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; return this; }
		public AdminBuilder resetPasswordTokenExpiry(LocalDateTime resetPasswordTokenExpiry) { this.resetPasswordTokenExpiry = resetPasswordTokenExpiry; return this; }
		public AdminBuilder resetOtp(String resetOtp) { this.resetOtp = resetOtp; return this; }
		public AdminBuilder resetOtpExpiry(LocalDateTime resetOtpExpiry) { this.resetOtpExpiry = resetOtpExpiry; return this; }

		public Admin build() {
			Admin a = new Admin();
			a.setId(id);
			a.setFullName(fullName);
			a.setEmail(email);
			a.setPassword(password);
			a.setPhone(phone);
			a.setProfileImage(profileImage);
			a.setRole(role);
			a.setStatus(status);
			a.setLastLogin(lastLogin);
			a.setDepartment(department);
			a.setDesignation(designation);
			a.setLocation(location);
			a.setTheme(theme);
			a.setLanguage(language);
			a.setSidebarCollapsed(sidebarCollapsed);
			a.setNotificationsEnabled(notificationsEnabled);
			a.setEmailNotifications(emailNotifications);
			a.setSystemNotifications(systemNotifications);
			a.setTwoFactorEnabled(twoFactorEnabled);
			a.setSessionTimeout(sessionTimeout);
			a.setCreatedAt(createdAt);
			a.setUpdatedAt(updatedAt);
			a.setResetPasswordToken(resetPasswordToken);
			a.setResetPasswordTokenExpiry(resetPasswordTokenExpiry);
			a.setResetOtp(resetOtp);
			a.setResetOtpExpiry(resetOtpExpiry);
			return a;
		}
	}
}
