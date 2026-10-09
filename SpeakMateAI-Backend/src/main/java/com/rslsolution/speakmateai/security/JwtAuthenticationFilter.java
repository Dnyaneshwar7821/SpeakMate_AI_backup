package com.rslsolution.speakmateai.security;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.rslsolution.speakmateai.util.JwtUtil;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtUtil jwtUtil;
	private final UserDetailsService userDetailsService;

	public JwtAuthenticationFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
		this.jwtUtil = jwtUtil;
		this.userDetailsService = userDetailsService;
	}

	private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(JwtAuthenticationFilter.class);

	@Override
	protected boolean shouldNotFilter(@NonNull HttpServletRequest request) throws ServletException {
		String path = request.getServletPath();
		return path.equals("/api/notification/stream");
	}

	@Override
	protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain)
			throws ServletException, IOException {

		String authHeader = request.getHeader("Authorization");
		String token = null;

		if (authHeader != null && authHeader.startsWith("Bearer ")) {
			token = authHeader.substring(7);
		} else {
			String tokenParam = request.getParameter("token");
			if (tokenParam != null && !tokenParam.isBlank() && !"null".equals(tokenParam) && !"undefined".equals(tokenParam)) {
				token = tokenParam;
			}
		}

		// Fallback to server-managed HttpOnly cookie for web clients
		if ((token == null || token.isBlank()) && request.getCookies() != null) {
			for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
				if ("speakmate_token".equals(cookie.getName())) {
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
				String email = jwtUtil.extractEmail(token);

				if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {

					UserDetails userDetails = userDetailsService.loadUserByUsername(email);

					if (jwtUtil.isTokenValid(token, userDetails.getUsername())) {
						if (!userDetails.isEnabled()) {
							response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
							response.setContentType("application/json");
							response.setCharacterEncoding("UTF-8");
							response.getWriter().write("{\"success\":false,\"message\":\"Your account has been deactivated. Access is restricted. Please contact your administrator for assistance.\"}");
							return;
						}

						UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
								userDetails, null, userDetails.getAuthorities());

						authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

						SecurityContextHolder.getContext().setAuthentication(authentication);
					}
				}
			}
		} catch (Exception e) {
			logger.warn("[JWT Filter] Token validation failed: {}", e.getMessage());
		}

		filterChain.doFilter(request, response);
	}
}