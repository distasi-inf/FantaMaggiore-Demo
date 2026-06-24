package it.fantamaggiore.backend.core.service;

import it.fantamaggiore.backend.core.audit.service.AuditLogService;
import it.fantamaggiore.backend.core.dto.UserUpdateDTO;
import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.Role;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.service.FormationService;
import it.fantamaggiore.backend.security.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * FIX GOD COMPONENT: La logica amministrativa sugli utenti è stata estratta
 * da UserService in questo servizio dedicato.
 *
 * UserService si occupa di: autenticazione, registrazione, profilo utente.
 * AdminUserService si occupa di: operazioni admin su altri utenti (ban, reset password, cambio ruolo).
 */
@Service
public class AdminUserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private FormationService formationService;

    @Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @Autowired
    private AuditLogService auditLogService;

    // 🔥 FIX: Iniettiamo il CacheManager
    @Autowired
    private org.springframework.cache.CacheManager cacheManager;

    // ---------------------------------------------------------------------------
    // Notifica WebSocket e Reset Cache
    // ---------------------------------------------------------------------------

    private void notifyUserUpdate(User user, String action) {
        // 1. Svuota la cache della classifica
        org.springframework.cache.Cache rankingCache = cacheManager.getCache("globalRanking");
        if (rankingCache != null) {
            rankingCache.clear();
        }

        // 2. Prepara i payload
        Map<String, Object> userPayload = new HashMap<>();
        userPayload.put("action", action);
        if (user != null) {
            userPayload.put("user", user);
        }

        Map<String, Object> rankingPayload = new HashMap<>();
        rankingPayload.put("action", "RELOAD");

        // 3. Invia i messaggi a commit completato
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/users", (Object) userPayload);
                    messagingTemplate.convertAndSend("/topic/rankings", (Object) rankingPayload); // Avvisa la classifica
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/users", (Object) userPayload);
            messagingTemplate.convertAndSend("/topic/rankings", (Object) rankingPayload);
        }
    }

    // ---------------------------------------------------------------------------
    // Controllo permessi gerarchici
    // ---------------------------------------------------------------------------

    private void checkHierarchicalPermissions(User actingAdmin, User targetUser) {
        if (targetUser.getRole() == Role.SUPER_ADMIN
                && !actingAdmin.getId().equals(targetUser.getId())) {
            throw new InvalidActionException(
                    "Violazione di sicurezza: impossibile modificare, declassare o eliminare un Super Amministratore.");
        }
        if (targetUser.getRole() == Role.ADMIN
                && actingAdmin.getRole() == Role.ADMIN
                && !actingAdmin.getId().equals(targetUser.getId())) {
            throw new InvalidActionException(
                    "Violazione di sicurezza: non hai i permessi per modificare o bannare un altro Amministratore di pari grado.");
        }
    }

    // ---------------------------------------------------------------------------
    // Operazioni admin
    // ---------------------------------------------------------------------------

    @Transactional
    public User adminUpdateUser(String adminEmail, Long id, UserUpdateDTO dto) {
        User adminExec = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        checkHierarchicalPermissions(adminExec, targetUser);

        if (dto.getRole() != null) {
            Role newRole = Role.valueOf(dto.getRole().toUpperCase());

            if (targetUser.getId().equals(adminExec.getId()) && newRole != adminExec.getRole()) {
                throw new InvalidActionException("Errore: Non puoi modificare o declassare il tuo stesso ruolo.");
            }
            if (newRole == Role.SUPER_ADMIN && adminExec.getRole() != Role.SUPER_ADMIN) {
                throw new InvalidActionException(
                        "Errore: Solo un Super Amministratore può promuovere altri utenti a Super Admin.");
            }
            targetUser.setRole(newRole);
        }

        if (dto.getEmail() != null && !dto.getEmail().equals(targetUser.getEmail())) {
            if (userRepository.existsByEmail(dto.getEmail())) {
                throw new InvalidActionException("Errore: Questa email è già in uso.");
            }
            targetUser.setEmail(dto.getEmail());
        }
        if (dto.getName() != null)      targetUser.setName(dto.getName());
        if (dto.getSurname() != null)   targetUser.setSurname(dto.getSurname());
        if (dto.getUsername() != null && !dto.getUsername().equals(targetUser.getUsername())) {
            if (userRepository.existsByUsername(dto.getUsername())) {
                throw new InvalidActionException("Errore: Username già esistente.");
            }
            targetUser.setUsername(dto.getUsername());
        }
        if (dto.getFantasyTeamName() != null) targetUser.setFantasyTeamName(dto.getFantasyTeamName());
        if (dto.getNationality() != null)     targetUser.setNationality(dto.getNationality());

        User savedUser = userRepository.save(targetUser);
        notifyUserUpdate(savedUser, "UPDATE");

        // Log dettagliato che include l'admin esecutore
        auditLogService.logAction(
                "UPDATE_USER",
                "User",
                id,
                "L'Admin " + adminExec.getEmail() + " ha modificato l'utente: " + targetUser.getUsername()
        );
        return savedUser;
    }

    @Transactional
    public void adminDeleteUser(String adminEmail, Long id) {
        User adminExec = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (adminExec.getId().equals(targetUser.getId())) {
            throw new InvalidActionException("Errore: Impossibile bannare il tuo stesso account.");
        }
        checkHierarchicalPermissions(adminExec, targetUser);

        targetUser.setLocked(true);
        User savedUser = userRepository.save(targetUser);

        // 🔥 FIX OPZIONE B: Cancella eventuali formazioni dell'utente per le giornate ancora OPEN
        List<it.fantamaggiore.backend.fantasy.model.Formation> userFormations = formationService.getFormationsByUserId(targetUser.getId());
        List<Formation> openFormations = userFormations.stream()
                .filter(f -> f.getMatchDay().getStatus() == it.fantamaggiore.backend.core.model.enums.MatchDayStatus.OPEN)
                .toList();

        if (!openFormations.isEmpty()) {
            formationService.deleteAllFormations(openFormations);
        }

        notifyUserUpdate(savedUser, "UPDATE");
        refreshTokenService.deleteRefreshTokenByUserId(targetUser.getId());

        // Log critico: Cancellazione utente
        auditLogService.logAction(
                "BAN_USER",
                "User",
                id,
                "L'Admin " + adminExec.getEmail() + " ha bannato/eliminato l'utente: " + targetUser.getEmail()
        );
    }

    @Transactional
    public void adminResetUserPassword(String adminEmail, Long id, String newPassword) {
        User adminExec = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        checkHierarchicalPermissions(adminExec, targetUser);

        if (newPassword == null || newPassword.length() < 6) {
            throw new InvalidActionException("La password deve contenere almeno 6 caratteri.");
        }

        // La password viene codificata nel controller tramite PasswordEncoder
        // per non accoppiare questo service con Spring Security
        targetUser.setPassword(newPassword); // già encoded dal controller
        User savedUser = userRepository.save(targetUser);
        notifyUserUpdate(savedUser, "UPDATE");
        refreshTokenService.deleteRefreshTokenByUserId(targetUser.getId());
        auditLogService.logAction("RESET_PASSWORD", "User", id, "Password resettata forzatamente per: " + targetUser.getUsername());
    }

    @Transactional
    public void adminRestoreUser(String adminEmail, Long id) {
        User adminExec = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        checkHierarchicalPermissions(adminExec, targetUser);

        targetUser.setLocked(false);
        User savedUser = userRepository.save(targetUser);
        notifyUserUpdate(savedUser, "UPDATE");
        auditLogService.logAction("RESTORE_USER", "User", id, "Utente ripristinato (sbannato): " + targetUser.getUsername());
    }
}
