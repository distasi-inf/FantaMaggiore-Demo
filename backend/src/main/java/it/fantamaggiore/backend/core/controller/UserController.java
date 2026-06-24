package it.fantamaggiore.backend.core.controller;

import it.fantamaggiore.backend.core.dto.*;
import it.fantamaggiore.backend.core.exceptions.ErrorResponseDTO;
import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.InvalidCredentialsException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.mapper.PlayerMapper;
import it.fantamaggiore.backend.core.mapper.UserMapper;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.service.AdminUserService;
import it.fantamaggiore.backend.core.service.PlayerService;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.security.model.RefreshToken;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserService userService;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PlayerMapper playerMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private it.fantamaggiore.backend.security.JwtUtil jwtUtil;

    @Autowired
    private it.fantamaggiore.backend.security.service.RefreshTokenService refreshTokenService;

    // ---------------------------------------------------------------------------
    // Auth pubbliche
    // ---------------------------------------------------------------------------

    @PostMapping("/register")
    public ResponseEntity<UserResponseDTO> userRegistration(@Valid @RequestBody UserRegistrationDTO userDTO) {
        return ResponseEntity.ok(userMapper.toDTO(userService.saveUser(userMapper.toEntity(userDTO))));
    }

    @PostMapping("/login")
    public ResponseEntity<?> userLogin(@RequestBody UserLoginDTO loginDTO) {
        try {
            User user = userService.login(loginDTO.getEmail(), loginDTO.getPassword());
            String accessToken  = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole().name());
            String refreshToken = refreshTokenService.createRefreshToken(user.getId()).getToken();
            return ResponseEntity.ok(new AuthResponseDTO(accessToken, refreshToken, userMapper.toDTO(user)));

        } catch (InvalidActionException e) {
            // Intercettiamo l'eccezione lanciata dal tuo UserService se l'utente è bannato
            if (e.getMessage().contains("sospeso")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        new ErrorResponseDTO(java.time.LocalDateTime.now(), 401, "Unauthorized", "Il tuo account è stato bloccato da un Amministratore."));
            }
            throw e;
        } catch (InvalidCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    new ErrorResponseDTO(java.time.LocalDateTime.now(), 401, "Unauthorized", "Credenziali non valide."));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request) {
        try {
            String requestRefreshToken = request.get("refreshToken");
            if (requestRefreshToken == null || requestRefreshToken.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                        new ErrorResponseDTO(java.time.LocalDateTime.now(), 400, "Bad Request", "Refresh token is missing"));
            }

            RefreshToken rToken = refreshTokenService.findByToken(requestRefreshToken);
            if (rToken == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        new ErrorResponseDTO(java.time.LocalDateTime.now(), 401, "Unauthorized", "Refresh token not found or invalid"));
            }

            rToken = refreshTokenService.verifyExpiration(rToken);
            User user = rToken.getUser();

            // --- INIEZIONE: CONTROLLO BAN DURANTE IL REFRESH ---
            if (user.isLocked()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        new ErrorResponseDTO(java.time.LocalDateTime.now(), 401, "Unauthorized", "Il tuo account è stato bloccato. Sessione terminata."));
            }

            // --- LA MAGIA DEL CAMBIO RUOLO ---
            // user.getRole().name() estrae il ruolo AGGIORNATO dal database!
            String newAccessToken = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole().name());
            return ResponseEntity.ok(new AuthResponseDTO(newAccessToken, requestRefreshToken, userMapper.toDTO(user)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    new ErrorResponseDTO(java.time.LocalDateTime.now(), 401, "Unauthorized", "Session expired. Please login again."));
        }
    }

    // ---------------------------------------------------------------------------
    // Controlli disponibilità (registrazione)
    // ---------------------------------------------------------------------------

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmailAvailability(@RequestParam String email) {
        return ResponseEntity.ok(userService.isEmailAvailable(email));
    }

    @GetMapping("/check-fantasy-name")
    public ResponseEntity<Boolean> checkFantasyNameAvailability(@RequestParam String name) {
        return ResponseEntity.ok(userService.isFantasyTeamNameAvailable(name));
    }

    @GetMapping("/check-username")
    public ResponseEntity<Boolean> checkUsernameAvailability(@RequestParam String username) {
        return ResponseEntity.ok(userService.isUsernameAvailable(username));
    }

    // ---------------------------------------------------------------------------
    // Profilo utente (self-service, richiede autenticazione)
    // ---------------------------------------------------------------------------

    @GetMapping()
    public ResponseEntity<Page<UserResponseDTO>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "TUTTI") String role
    ) {
        // Ora il Service fa tutto il lavoro pesante!
        Page<UserResponseDTO> usersPage = userService.getAllUsersPagedAndSearched(page, size, search, role).map(userMapper::toDTO);

        return ResponseEntity.ok(usersPage);
    }

    @GetMapping("/for-matchday/{matchDayId}")
    public ResponseEntity<List<UserResponseDTO>> getUsersForMatchDay(@PathVariable Long matchDayId) {
        List<User> users = userService.getUsersForMatchDay(matchDayId);
        return ResponseEntity.ok(users.stream().map(userMapper::toDTO).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userMapper.toDTO(userService.getUser(id)));
    }

    @PutMapping("/me/player/{idPlayer}")
    public ResponseEntity<UserResponseDTO> linkPlayerToUser(Authentication authentication, @PathVariable Long idPlayer) {
        userService.userToPlayer(authentication.getName(), idPlayer);
        return ResponseEntity.ok(userMapper.toDTO(userService.getUserByEmail(authentication.getName())));
    }

    @DeleteMapping("/logout")
    public ResponseEntity<String> logoutUser(Authentication authentication) {
        User user = userService.getUserByEmail(authentication.getName());
        refreshTokenService.deleteRefreshTokenByUserId(user.getId());
        return ResponseEntity.ok("Logout successful. Refresh token deleted.");
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponseDTO> updateMyProfile(Authentication authentication, @RequestBody UserUpdateDTO dto) {
        return ResponseEntity.ok(userMapper.toDTO(userService.updateProfile(authentication.getName(), dto)));
    }

    @DeleteMapping("/me")
    public ResponseEntity<String> deleteMyAccount(Authentication authentication) {
        userService.deleteMyAccount(authentication.getName());
        return ResponseEntity.ok("Account deleted successfully");
    }

    @DeleteMapping("/me/player")
    public ResponseEntity<UserResponseDTO> unlinkMyPlayer(Authentication authentication) {
        userService.unlinkMyPlayer(authentication.getName());
        return ResponseEntity.ok(userMapper.toDTO(userService.getUserByEmail(authentication.getName())));
    }

    @PutMapping("/me/password")
    public ResponseEntity<String> changePassword(Authentication authentication, @RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.length() < 6) {
            throw new InvalidActionException("Password must be at least 6 characters long");
        }
        userService.changeMyPassword(authentication.getName(), newPassword);
        return ResponseEntity.ok("Password updated successfully");
    }

    // ---------------------------------------------------------------------------
    // Rotte admin — delegano ad AdminUserService
    // ---------------------------------------------------------------------------

    @PutMapping("/{id}")
    public ResponseEntity<UserResponseDTO> adminUpdateUser(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody UserUpdateDTO dto) {
        return ResponseEntity.ok(userMapper.toDTO(
                adminUserService.adminUpdateUser(authentication.getName(), id, dto)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> adminDeleteUser(
            Authentication authentication,
            @PathVariable Long id) {
        adminUserService.adminDeleteUser(authentication.getName(), id);
        return ResponseEntity.ok(Map.of("message", "Utente eliminato con successo."));
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Map<String, String>> adminResetPassword(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.length() < 6) {
            throw new InvalidActionException("La password deve contenere almeno 6 caratteri.");
        }
        // Encoding della password prima di passarla al service per non accoppiare
        // AdminUserService con Spring Security PasswordEncoder
        String encoded = passwordEncoder.encode(newPassword);
        adminUserService.adminResetUserPassword(authentication.getName(), id, encoded);
        return ResponseEntity.ok(Map.of("message", "Password resettata con successo."));
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<Map<String, String>> adminRestoreUser(
            Authentication authentication,
            @PathVariable Long id) {
        adminUserService.adminRestoreUser(authentication.getName(), id);
        return ResponseEntity.ok(Map.of("message", "Utente ripristinato con successo."));
    }

    // ===========================================================================
    // GESTIONE ALTER-EGO (Self-Service e Sicuro)
    // ===========================================================================

    @PostMapping("/me/player/create")
    @Transactional // 🔥 FONDAMENTALE per non lasciare "fantasmi" se c'è un errore
    public ResponseEntity<PlayerResponseDTO> createMyPlayer(
            Authentication authentication,
            @RequestBody PlayerRequestDTO dto) {

        User user = userService.getUserByEmail(authentication.getName());
        if (user.getPlayer() != null) {
            throw new InvalidActionException("Hai già un alter-ego.");
        }

        // 1. Convertiamo in entità
        Player player = playerMapper.toEntity(dto);

        // 2. Chiamiamo il service (che è void).
        // MAGIA DI HIBERNATE: Anche se il metodo non restituisce nulla,
        // dopo questa riga l'oggetto 'player' si aggiornerà automaticamente con l'ID generato!
        playerService.savePlayer(player);

        // 3. Ora player.getId() ha un numero valido. Lo colleghiamo!
        userService.linkMyPlayer(authentication.getName(), player.getId());

        return ResponseEntity.ok(playerMapper.toDTO(player));
    }

    @PutMapping("/me/player/edit")
    public ResponseEntity<PlayerResponseDTO> updateMyPlayer(
            Authentication authentication,
            @RequestBody PlayerRequestDTO dto) {

        User user = userService.getUserByEmail(authentication.getName());
        Player player = user.getPlayer();
        if (player == null) {
            throw new ResourceNotFoundException("Nessun alter-ego da modificare.");
        }

        // Forza l'ID dell'utente loggato nel DTO per estrema sicurezza
        dto.setUserId(user.getId());

        // Usiamo PlayerService che spara in automatico il WebSocket per l'Admin
        Player updatedPlayer = playerService.updatePlayer(player.getId(), dto);
        return ResponseEntity.ok(playerMapper.toDTO(updatedPlayer));
    }

    @DeleteMapping("/me/player/delete")
    public ResponseEntity<Map<String, String>> deleteMyPlayer(Authentication authentication) {
        User user = userService.getUserByEmail(authentication.getName());
        Player player = user.getPlayer();
        if (player == null) {
            throw new ResourceNotFoundException("Nessun alter-ego da eliminare.");
        }

        // 1. Prima scolleghiamo l'utente
        userService.unlinkMyPlayer(authentication.getName());

        // 2. Poi usiamo PlayerService per spostare nel cestino e avvisare il pannello Admin
        playerService.deletePlayer(player.getId());

        return ResponseEntity.ok(Map.of("message", "Alter-ego eliminato definitivamente."));
    }
}
