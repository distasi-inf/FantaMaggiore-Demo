package it.fantamaggiore.backend.core.service;

import it.fantamaggiore.backend.core.dto.UserUpdateDTO;
import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.InvalidCredentialsException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.Role;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.security.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * FIX GOD COMPONENT: UserService gestisce SOLO autenticazione, registrazione
 * e operazioni sul proprio profilo (self-service).
 * Le operazioni admin su altri utenti sono in AdminUserService.
 */
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @Autowired
    private org.springframework.cache.CacheManager cacheManager;

    // ---------------------------------------------------------------------------
    // Registrazione e autenticazione
    // ---------------------------------------------------------------------------

    @Transactional
    public User saveUser(User user) {
        if (user.getRole() == null) {
            user.setRole(Role.USER);
        }
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new InvalidActionException("Error: This email is already registered.");
        }
        if (user.getFantasyTeamName() != null && !user.getFantasyTeamName().isBlank()) {
            if (userRepository.existsByFantasyTeamName(user.getFantasyTeamName())) {
                throw new InvalidActionException(
                        "Error: The Fantasy Team name is already in use. Please choose another.");
            }
        }
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new InvalidActionException("Error: This username is already taken.");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        User savedUser = userRepository.save(user);

        // Usa il nuovo helper!
        clearCacheAndNotify(savedUser, "CREATE");

        return savedUser;
    }

    @Transactional(readOnly = true)
    public User login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid credentials"));

        if (user.isLocked()) {
            throw new InvalidActionException("Il tuo account è stato sospeso dall'amministratore.");
        }
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new InvalidCredentialsException("Invalid credentials");
        }
        return user;
    }

    // ---------------------------------------------------------------------------
    // Query
    // ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<User> getAllUsersPagedAndSearched(int page, int size, String search, String role) {

        org.springframework.data.domain.PageRequest cleanPageable =
                org.springframework.data.domain.PageRequest.of(page, size);

        // Se il ruolo è "TUTTI", passiamo null al database così li prende tutti
        String roleFilter = null;
        if (role != null && !role.equalsIgnoreCase("TUTTI") && !role.isBlank()) {
            roleFilter = role.toUpperCase();
        }

        return userRepository.findUsersFilteredAndAdminFirst(roleFilter, search, cleanPageable);
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<User> getUsersForMatchDay(Long matchDayId) {
        it.fantamaggiore.backend.core.model.MatchDay matchDay = matchDayService.getMatchDayById(matchDayId);
        List<User> allUsers = userRepository.findAll();

        if (matchDay.getStatus() == it.fantamaggiore.backend.core.model.enums.MatchDayStatus.OPEN) {
            // Se la giornata è OPEN, escludiamo gli utenti bannati
            return allUsers.stream().filter(u -> !u.isLocked()).toList();
        }
        // Se è LIVE o CALCULATED, li restituiamo tutti per lo storico
        return allUsers;
    }

    @Transactional(readOnly = true)
    public User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    // ---------------------------------------------------------------------------
    // Profilo utente (self-service)
    // ---------------------------------------------------------------------------

    @Transactional
    public void userToPlayer(String email, Long idPlayer) {
        User user = getUserByEmail(email);
        if (user.getPlayer() != null) {
            throw new InvalidActionException("This user already has a player profile associated with it!");
        }
        Player player = playerService.getPlayerById(idPlayer);
        player.setUser(user);
        user.setPlayer(player);
        playerService.savePlayer(player);
    }

    @Transactional
    public User updateProfile(String email, UserUpdateDTO dto) {
        User user = getUserByEmail(email);

        if (dto.getUsername() != null && !dto.getUsername().equals(user.getUsername())) {
            if (userRepository.existsByUsername(dto.getUsername())) {
                throw new InvalidActionException("Error: This username is already taken by another user.");
            }
            user.setUsername(dto.getUsername());
        }
        if (dto.getName() != null) user.setName(dto.getName());
        if (dto.getSurname() != null) user.setSurname(dto.getSurname());
        if (dto.getNationality() != null) user.setNationality(dto.getNationality());
        if (dto.getFantasyTeamName() != null) {
            if (!dto.getFantasyTeamName().equals(user.getFantasyTeamName())
                    && userRepository.existsByFantasyTeamName(dto.getFantasyTeamName())) {
                throw new InvalidActionException("Error: Fantasy Team name already in use.");
            }
            user.setFantasyTeamName(dto.getFantasyTeamName());
        }

        User savedUser = userRepository.save(user);

        // Usa il nuovo helper!
        clearCacheAndNotify(savedUser, "UPDATE");

        return savedUser;
    }

    @Transactional
    public void deleteMyAccount(String email) {
        User user = getUserByEmail(email);
        if (user.getPlayer() != null) {
            user.getPlayer().setUser(null);
            user.setPlayer(null);
        }
        user.setEmail("deleted_" + user.getId() + "@null.com");
        user.setPassword("DELETED");
        user.setName("User");
        user.setSurname("Deleted");
        user.setUsername("deleted_" + user.getId());
        user.setFantasyTeamName("Team Retired " + user.getId());
        userRepository.save(user);
        refreshTokenService.deleteRefreshTokenByUserId(user.getId());
    }

    @Transactional
    public void unlinkMyPlayer(String email) {
        User user = getUserByEmail(email);
        if (user.getPlayer() != null) {
            user.getPlayer().setUser(null);
            user.setPlayer(null);
            userRepository.save(user);
        } else {
            throw new InvalidActionException("You don't have any player linked to your account.");
        }
    }

    @Transactional
    public void changeMyPassword(String email, String newPassword) {
        User user = getUserByEmail(email);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ---------------------------------------------------------------------------
    // Controlli disponibilità (usati in registrazione/validazione form)
    // ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public boolean isEmailAvailable(String email) {
        return !userRepository.existsByEmail(email);
    }

    @Transactional(readOnly = true)
    public boolean isFantasyTeamNameAvailable(String fantasyTeamName) {
        return !userRepository.existsByFantasyTeamName(fantasyTeamName);
    }

    @Transactional(readOnly = true)
    public boolean isUsernameAvailable(String username) {
        return !userRepository.existsByUsername(username);
    }

    @Transactional
    public void linkMyPlayer(String email, Long playerId) {
        // Trova l'utente
        User user = getUserByEmail(email);

        // Trova il giocatore (usiamo il tuo PlayerService che è già iniettato)
        Player player = playerService.getPlayerByIdIncludingDeleted(playerId);

        // Collega i due lati
        user.setPlayer(player);
        player.setUser(user);

        // Salva l'aggiornamento
        userRepository.save(user);
    }

    // 🔥 FIX: Aggiungi questo metodo helper per centralizzare Cache e WebSocket
    private void clearCacheAndNotify(User user, String action) {
        org.springframework.cache.Cache rankingCache = cacheManager.getCache("globalRanking");
        if (rankingCache != null) rankingCache.clear();

        java.util.Map<String, Object> userPayload = new java.util.HashMap<>();
        userPayload.put("action", action);
        userPayload.put("user", user);

        java.util.Map<String, Object> rankingPayload = new java.util.HashMap<>();
        rankingPayload.put("action", "RELOAD");

        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/users", (Object) userPayload);
                    messagingTemplate.convertAndSend("/topic/rankings", (Object) rankingPayload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/users", (Object) userPayload);
            messagingTemplate.convertAndSend("/topic/rankings", (Object) rankingPayload);
        }
    }
}
