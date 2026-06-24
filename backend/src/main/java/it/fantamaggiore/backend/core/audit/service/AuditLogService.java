package it.fantamaggiore.backend.core.audit.service;

import it.fantamaggiore.backend.core.audit.model.AuditLog;
import it.fantamaggiore.backend.core.audit.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate; // <-- IMPORTANTE
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization; // <-- IMPORTANTE
import org.springframework.transaction.support.TransactionSynchronizationManager; // <-- IMPORTANTE

import java.util.HashMap;
import java.util.Map;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // <-- INIETTATO IL MEGAFONO

    // === METODO PER NOTIFICARE IL FRONTEND ===
    private void notifyNewAuditLog(AuditLog log) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "NEW_LOG");
        payload.put("log", log);

        // Inviamo il log in modo sicuro solo dopo il commit sul DB
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/audit-logs", (Object) payload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/audit-logs", (Object) payload);
        }
    }

    public void logAction(String action, String entityName, Long entityId, String details) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // --- FILTRO SUPER ADMIN ---
        if (auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN") || a.getAuthority().equals("SUPER_ADMIN"))) {
            return;
        }

        String currentAdmin = (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser"))
                ? auth.getName() : "SISTEMA";

        AuditLog log = new AuditLog();
        log.setAdminUsername(currentAdmin);
        log.setAction(action);
        log.setEntityName(entityName);
        log.setEntityId(entityId);
        log.setDetails(details);

        AuditLog savedLog = auditLogRepository.save(log);

        // === LA CHIAMATA ALLA MAGIA ===
        notifyNewAuditLog(savedLog);
    }

    public Page<AuditLog> getLogsPaged(String search, Pageable pageable) {
        if (search == null || search.trim().isEmpty()) {
            return auditLogRepository.findAll(pageable);
        }
        return auditLogRepository.searchLogs(search.trim(), pageable);
    }
}