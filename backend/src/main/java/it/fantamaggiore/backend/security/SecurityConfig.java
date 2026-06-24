package it.fantamaggiore.backend.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthFilter;

    @Value("#{'${fantamaggiore.cors.allowed-origins}'.split(',')}")
    private List<String> allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(org.springframework.security.config.Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setContentType("application/json");
                            response.setStatus(401);
                            response.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"Token missing or expired\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setContentType("application/json");
                            response.setStatus(403);
                            response.getWriter().write("{\"error\": \"Forbidden\", \"message\": \"Non hai i permessi per questa azione\"}");
                        })
                )

                .authorizeHttpRequests(auth -> auth

                        // --- ROTTA MAGICA PER SBLOCCARE GLI ERRORI 500 ---
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()

                        // --- ROTTE PUBBLICHE ---
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users/login", "/api/users/register", "/api/users/refresh").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/check-email", "/api/users/check-fantasy-name", "/api/users/check-username").permitAll()
                        .requestMatchers("/ws/**").permitAll()

                        // --- ROTTE LETTURA GLOBALI (Sbloccate per utenti autenticati) ---
                        // Necessarie per far funzionare Match View e Calendario
                        .requestMatchers(HttpMethod.GET, "/api/users").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/players/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/tournaments/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/matchdays/**").authenticated()

                        // --- ROTTE UTENTI (Self-Service) ---
                        .requestMatchers(HttpMethod.PUT, "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/users/me/**").authenticated()

                        // --- ROTTE ADMIN: UTENTI ---
                        .requestMatchers(HttpMethod.PUT, "/api/users/*/password", "/api/users/*/restore").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/users/*").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/users/*").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // --- ROTTE ADMIN: GIOCATORI ---
                        .requestMatchers(HttpMethod.POST, "/api/players/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/players/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/players/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // --- ROTTE ADMIN: TORNEI E GIORNATE ---
                        .requestMatchers(HttpMethod.POST, "/api/tournaments/**", "/api/matchdays/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/tournaments/**", "/api/matchdays/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/tournaments/**", "/api/matchdays/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        .requestMatchers("/api/audit-logs/**").hasRole("SUPER_ADMIN")

                        // --- TUTTO IL RESTO ---
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated()
                )

                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        source.registerCorsConfiguration("/ws/**", configuration);
        return source;
    }
}
