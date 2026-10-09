package com.rslsolution.speakmateai.security;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.rslsolution.speakmateai.entity.Admin;
import com.rslsolution.speakmateai.enums.AdminStatus;
import com.rslsolution.speakmateai.enums.Role;
import com.rslsolution.speakmateai.repository.AdminRepository;
import com.rslsolution.speakmateai.util.JwtUtil;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AdminJwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtUtil jwtUtil;
	private final AdminRepository adminRepository;

	public AdminJwtAuthenticationFilter(JwtUtil jwtUtil, AdminRepository adminRepository) {
		this.jwtUtil = jwtUtil;
		this.adminRepository = adminRepository;
	}

	private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AdminJwtAuthenticationFilter.class);

	@Override
	protected boolean shouldNotFilter(@NonNull HttpServletRequest request) throws ServletException {
		String path = request.getServletPath();
		// This filter runs for /api/admin/ endpoints and /api/assistant/ endpoints.
		return !path.startsWith("/api/admin/") && !path.startsWith("/api/assistant/");
	}

	@Override
	protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain)
			throws ServletException, IOException {

		String authHeader = request.getHeader("Authorization");
		String token = null;

		if (authHeader != null && authHeader.startsWith("Bearer ")) {
			token = authHeader.substring(7);
		} else if (request.getCookies() != null) {
			for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
				if ("speakmate_token".equals(cookie.getName()) || "speakmate_admin_token".equals(cookie.getName())) {
					String cookieVal = cookie.getValue();
					if (cookieVal != null && !cookieVal.isBlank() && !"null".equals(cookieVal) && !"undefined".equals(cookieVal)) {
						token = cookieVal;
						break;
					}
				}
			}
		}

		if (token == null || token.isBlank()) {
			filterChain.doFilter(request, response);
			return;
		}

		try {
			if (token != null && !token.isBlank() && !"null".equals(token) && !"undefined".equals(token)) {
				// Assert type claim is ADMIN
				String type = null;
				try {
					type = jwtUtil.extractClaims(token).get("type", String.class);
				} catch (Exception e) {
					// ignore parsing issues
				}

				if ("ADMIN".equals(type)) {
					String email = jwtUtil.extractEmail(token);

					if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
						Admin admin = adminRepository.findByEmail(email).orElse(null);

						if (admin != null) {
							if (admin.getRole() != Role.SUPER_ADMIN && admin.getStatus() != AdminStatus.ACTIVE) {
								response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
								response.setContentType("application/json");
								response.setCharacterEncoding("UTF-8");
								response.getWriter().write("{\"success\":false,\"message\":\"Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.\"}");
								return;
							}
							if (jwtUtil.isTokenValid(token, admin.getEmail())) {
								UserDetails userDetails = org.springframework.security.core.userdetails.User
										.withUsername(admin.getEmail())
										.password(admin.getPassword())
										.roles(admin.getRole().name())
										.build();

								UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
										userDetails, null, userDetails.getAuthorities());

								authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

								SecurityContextHolder.getContext().setAuthentication(authentication);
							}
						}
					}
				}
			}
		} catch (Exception e) {
			logger.warn("[Admin JWT Filter] Token validation failed: {}", e.getMessage());
		}

		filterChain.doFilter(request, response);
	}
}
